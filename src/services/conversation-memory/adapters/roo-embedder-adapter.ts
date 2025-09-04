import type { IEmbedder as RooEmbedder } from "../../code-index/interfaces/embedder"
import type { IEmbedder } from "../interfaces"

export class RooEmbedderAdapter implements IEmbedder {
	public readonly dimension: number
	constructor(
		private readonly inner: RooEmbedder,
		dim: number,
	) {
		this.dimension = dim
	}

	async embed(text: string): Promise<number[]> {
		console.log("[RooEmbedderAdapter] embed called for text length:", text.length)
		try {
			const res = await this.inner.createEmbeddings([text])
			const embedding = res.embeddings?.[0] || []
			console.log("[RooEmbedderAdapter] embedding result length:", embedding.length)

			if (embedding.length === 0) {
				console.error("[RooEmbedderAdapter] Embedder returned empty array - likely missing API key")
				throw new Error("Embedder returned empty embedding - check API key configuration")
			}

			return embedding
		} catch (error: any) {
			console.error("[RooEmbedderAdapter] Failed to create embedding:", error)
			console.error("[RooEmbedderAdapter] Error details:", error?.message || String(error))

			// Check for common API errors
			if (error?.message?.includes("401") || error?.message?.includes("Unauthorized")) {
				throw new Error("Invalid or missing API key for embedder")
			} else if (error?.message?.includes("429")) {
				throw new Error("Rate limit exceeded for embedder API")
			} else if (error?.message?.includes("ECONNREFUSED")) {
				throw new Error("Cannot connect to embedder service")
			}

			// Re-throw the error instead of returning empty array
			throw error
		}
	}

	async embedBatch(texts: string[]): Promise<number[][]> {
		const res = await this.inner.createEmbeddings(texts)
		return res.embeddings || []
	}
}
