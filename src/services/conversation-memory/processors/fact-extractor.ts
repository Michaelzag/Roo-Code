import type { ILlmProvider } from "../interfaces"
import type { CategorizedFactInput, Message, ProjectContext } from "../types"

export class ConversationFactExtractor {
	constructor(private readonly llm?: ILlmProvider) {}

	public async extractFacts(messages: Message[], project: ProjectContext): Promise<CategorizedFactInput[]> {
		console.log("[ConversationFactExtractor] extractFacts called with", messages.length, "messages")
		if (this.llm) {
			try {
				console.log("[ConversationFactExtractor] Using LLM for extraction")
				const prompt = this.buildPrompt(messages, project)
				console.log("[ConversationFactExtractor] Built prompt, length:", prompt.length)
				const json = await this.llm.generateJson(prompt, { temperature: 0.1, max_tokens: 1500 })
				console.log("[ConversationFactExtractor] LLM response:", JSON.stringify(json))
				const facts = Array.isArray(json?.facts) ? json.facts : []
				console.log("[ConversationFactExtractor] Extracted", facts.length, "facts from LLM")
				return facts
					.map((f: any) => ({
						content: typeof f?.content === "string" ? f.content.trim() : "",
						category: typeof f?.category === "string" ? (f.category as any) : "pattern",
						confidence: typeof f?.confidence === "number" ? Math.min(1, Math.max(0, f.confidence)) : 0.7,
					}))
					.filter((f: CategorizedFactInput) => f.content.length > 0)
			} catch (error) {
				console.error("[ConversationFactExtractor] LLM extraction failed:", error)
				console.log("[ConversationFactExtractor] Falling back to heuristic extraction")
				// fallthrough to heuristic
			}
		}
		return this.heuristicExtract(messages)
	}

	/**
	 * LLM-first extraction with an explicit provider; returns [] on failure (no heuristic fallback).
	 */
	public async extractFactsWithProvider(
		messages: Message[],
		project: ProjectContext,
		llm: ILlmProvider,
	): Promise<CategorizedFactInput[]> {
		console.log("[ConversationFactExtractor] extractFactsWithProvider called with", messages.length, "messages")
		try {
			const prompt = this.buildPrompt(messages, project)
			console.log("[ConversationFactExtractor] Built prompt for provider, length:", prompt.length)
			const json = await llm.generateJson(prompt, { temperature: 0.1, max_tokens: 1500 })
			console.log("[ConversationFactExtractor] Provider response:", JSON.stringify(json))
			const facts = Array.isArray(json?.facts) ? json.facts : []
			return facts
				.map((f: any) => ({
					content: typeof f?.content === "string" ? f.content.trim() : "",
					category: typeof f?.category === "string" ? (f.category as any) : "pattern",
					confidence: typeof f?.confidence === "number" ? Math.min(1, Math.max(0, f.confidence)) : 0.7,
				}))
				.filter((f: CategorizedFactInput) => f.content.length > 0)
			const result = facts.filter((f: any) => f.content && f.content.length > 0)
			console.log("[ConversationFactExtractor] Returning", result.length, "valid facts")
			return result
		} catch (error) {
			console.error("[ConversationFactExtractor] Provider extraction failed:", error)
			return []
		}
	}

	private heuristicExtract(messages: Message[]): CategorizedFactInput[] {
		const text = messages
			.map((m) => m?.content || "")
			.join(" ")
			.toLowerCase()
		const facts: CategorizedFactInput[] = []
		// Very lightweight signals
		if (/react|vue|angular|next|svelte|astro/.test(text)) {
			facts.push({ content: "Frontend framework selected", category: "infrastructure", confidence: 0.6 })
		}
		if (/postgres|mysql|sqlite|mongodb|prisma/.test(text)) {
			facts.push({ content: "Database technology decision", category: "infrastructure", confidence: 0.6 })
		}
		if (/jwt|session|oauth|sso|auth/.test(text)) {
			facts.push({ content: "Authentication approach discussed", category: "architecture", confidence: 0.55 })
		}
		if (/error|exception|bug|fix|resolved|leak|memory/.test(text)) {
			facts.push({ content: "Active debugging context detected", category: "debugging", confidence: 0.5 })
		}
		return facts
	}

	private buildPrompt(messages: Message[], project: ProjectContext): string {
		const conversation = messages
			.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
			.join("\n")
			.slice(0, 4000)

		console.log("[ConversationFactExtractor] Building prompt with conversation length:", conversation.length)
		console.log("[ConversationFactExtractor] First 200 chars of conversation:", conversation.slice(0, 200))

		return `You are organizing technical facts for a ${project.language} project.
Project: ${project.workspaceName}
Framework: ${project.framework || "none"}
Package Manager: ${project.packageManager || "unknown"}

Categories:
- infrastructure — core tech stack, DB, deployment (persistent)
- architecture — design decisions and approaches (can be superseded)
- debugging — current problems/issues (temporary; resolve → promote)
- pattern — solutions & lessons learned (persistent wisdom)

CONVERSATION EPISODE:
${conversation}

Return JSON: { "facts": [{ "content": string, "category": "infrastructure"|"architecture"|"debugging"|"pattern", "confidence": number }] }`
	}
}
