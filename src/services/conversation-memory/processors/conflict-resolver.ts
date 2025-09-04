import type { CategorizedFactInput, MemoryAction } from "../types"
import type { IVectorStore } from "../interfaces"

// Lightweight heuristic conflict resolver (no LLM dependency)
export class ConflictResolver {
	constructor(
		private readonly vectorStore: IVectorStore,
		private readonly workspacePath: string,
	) {}

	public async resolve(fact: CategorizedFactInput): Promise<MemoryAction[]> {
		// If we don't have an embedding yet, we can't search; default to ADD
		if (!fact.embedding || fact.embedding.length === 0) {
			return [{ type: "ADD", fact }]
		}

		const filters: Record<string, any> = { workspace_path: this.workspacePath }
		if (fact.category) filters["category"] = fact.category

		const candidates = await this.vectorStore.search(fact.content, fact.embedding, 8, filters)

		// If a near-duplicate exists, ignore
		const exactLike = candidates.find(
			(c) => (c.score ?? 0) > 0.95 && (c.payload?.content || "").toLowerCase() === fact.content.toLowerCase(),
		)
		if (exactLike) return [{ type: "IGNORE", fact, target_ids: [exactLike.id as string] }]

		// Architecture: supersede when similar but different text
		if (fact.category === "architecture") {
			const close = candidates.filter(
				(c) => (c.score ?? 0) > 0.8 && (c.payload?.content || "").toLowerCase() !== fact.content.toLowerCase(),
			)
			if (close.length > 0) {
				return [{ type: "SUPERSEDE", fact, target_ids: close.map((c) => c.id as string) }]
			}
		}

		// Debugging: if content contains resolved/fixed and similar prior debugging exists, delete existing
		if (fact.category === "debugging" && /fixed|resolve|resolved|no longer/i.test(fact.content)) {
			const close = candidates.filter((c) => (c.score ?? 0) > 0.85)
			if (close.length > 0) {
				return [{ type: "DELETE_EXISTING", fact, target_ids: close.map((c) => c.id as string) }]
			}
		}

		return [{ type: "ADD", fact }]
	}
}
