import type { ILlmProvider } from "../interfaces"
import type { ApiHandler } from "../../../api"

/**
 * ILlmProvider that delegates JSON generation to the active Task ApiHandler
 * (same provider/model the agent used).
 */
export class RooApiLlmProviderAdapter implements ILlmProvider {
	constructor(private readonly api: ApiHandler) {}

	async generateJson(prompt: string, _options?: { temperature?: number; max_tokens?: number }): Promise<any> {
		console.log("[RooApiLlmProviderAdapter] generateJson called")
		console.log("[RooApiLlmProviderAdapter] Prompt length:", prompt.length)

		// Strict instruction to force JSON-only output
		const SYSTEM = `You are a JSON-only function. Return a single JSON object.
No prose, no markdown fences, no extra text. If you cannot produce JSON, return {}.`

		const request = [{ role: "user" as const, content: prompt }]

		// Create a timeout promise
		const timeoutMs = 30000 // 30 seconds
		const timeoutPromise = new Promise((_, reject) => {
			setTimeout(() => reject(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs)
		})

		try {
			console.log("[RooApiLlmProviderAdapter] Creating message stream with", timeoutMs, "ms timeout")
			const stream = this.api.createMessage(SYSTEM, request)

			// Race between the stream processing and timeout
			const text = (await Promise.race([
				(async () => {
					let result = ""
					let chunkCount = 0
					for await (const chunk of stream) {
						if (chunk.type === "text") {
							result += chunk.text
							chunkCount++
						}
					}
					console.log("[RooApiLlmProviderAdapter] Stream complete:", {
						chunks: chunkCount,
						responseLength: result.length,
					})
					return result
				})(),
				timeoutPromise,
			])) as string

			const cleaned = text
				.trim()
				.replace(/^```(?:json)?/i, "")
				.replace(/```$/, "")
				.trim()

			console.log("[RooApiLlmProviderAdapter] Cleaned response length:", cleaned.length)

			try {
				const result = JSON.parse(cleaned)
				console.log("[RooApiLlmProviderAdapter] Successfully parsed JSON")
				return result
			} catch (parseError) {
				console.warn("[RooApiLlmProviderAdapter] Failed to parse JSON, attempting recovery:", parseError)
				// Try to salvage the first JSON object if present
				const first = cleaned.indexOf("{")
				const last = cleaned.lastIndexOf("}")
				if (first >= 0 && last > first) {
					const slice = cleaned.slice(first, last + 1)
					try {
						const recovered = JSON.parse(slice)
						console.log("[RooApiLlmProviderAdapter] Recovered JSON from slice")
						return recovered
					} catch (sliceError) {
						console.error("[RooApiLlmProviderAdapter] Failed to recover JSON:", sliceError)
					}
				}
				console.log("[RooApiLlmProviderAdapter] Returning empty object as fallback")
				return {}
			}
		} catch (error) {
			console.error("[RooApiLlmProviderAdapter] Error in generateJson:", error)
			throw error
		}
	}
}
