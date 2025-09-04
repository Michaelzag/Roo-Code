import type { IVectorStore, IEmbedder } from "../interfaces"
import type { ConversationFact, EpisodeSearchResult } from "../types"
import { TemporalScorer } from "../lifecycle/temporal"

export class EpisodeSearchService {
	constructor(
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
		private readonly temporal: TemporalScorer,
		private readonly workspacePath: string,
	) {}

	async searchByEpisode(query: string, limit: number = 5): Promise<EpisodeSearchResult[]> {
		// 1. Standard vector search for relevant facts
		const embedding = await this.embedder.embed(query)
		const factResults = await this.vectorStore.search(
			query,
			embedding,
			50, // Get more results for episode grouping
			{ workspace_path: this.workspacePath },
		)

		// 2. Group results by episode
		const episodeGroups = new Map<string, ConversationFact[]>()

		for (const result of factResults) {
			const fact = result.payload as ConversationFact
			const episodeId = fact.episode_id || "unknown"

			if (!episodeGroups.has(episodeId)) {
				episodeGroups.set(episodeId, [])
			}
			episodeGroups.get(episodeId)!.push(fact)
		}

		// 3. Score episodes by relevance
		const episodeResults: EpisodeSearchResult[] = []

		for (const [episodeId, facts] of episodeGroups) {
			const episodeScore = this.calculateEpisodeRelevance(facts, query)
			const episodeContext = facts[0]?.episode_context || "Episode context unavailable"

			episodeResults.push({
				episode_id: episodeId,
				episode_context: episodeContext,
				relevance_score: episodeScore,
				fact_count: facts.length,
				facts: facts.sort((a, b) => b.confidence - a.confidence), // Best facts first
				timeframe: this.formatEpisodeTimeframe(facts),
			})
		}

		// 4. Return episodes sorted by relevance
		return episodeResults.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, limit)
	}

	private calculateEpisodeRelevance(facts: ConversationFact[], query: string): number {
		// Episode relevance = average fact confidence + episode coherence bonus
		const avgFactRelevance = facts.reduce((sum, fact) => sum + fact.confidence, 0) / facts.length
		const coherenceBonus = facts.length > 3 ? 0.1 : 0 // Bonus for substantial episodes

		return avgFactRelevance + coherenceBonus
	}

	private formatEpisodeTimeframe(facts: ConversationFact[]): string {
		if (facts.length === 0) return "Unknown timeframe"

		const times = facts
			.map((f) => {
				const refTime = f.reference_time
				return refTime instanceof Date ? refTime.getTime() : new Date(refTime).getTime()
			})
			.sort()
		const earliest = new Date(times[0])
		const latest = new Date(times[times.length - 1])

		// Same day
		if (earliest.toDateString() === latest.toDateString()) {
			return earliest.toLocaleDateString()
		}

		// Date range
		return `${earliest.toLocaleDateString()} - ${latest.toLocaleDateString()}`
	}
}
