import type { IEmbedder, IVectorStore } from "./interfaces"
import type { ConversationFact, SearchOptions, EpisodeSearchResult } from "./types"
import { TemporalScorer } from "./lifecycle/temporal"
import { EpisodeSearchService } from "./episode/EpisodeSearchService"

export class ConversationMemorySearchService {
	private episodeSearchService: EpisodeSearchService

	constructor(
		private readonly embedder: IEmbedder,
		private readonly vectorStore: IVectorStore,
		private readonly temporal: TemporalScorer,
		private readonly workspacePath: string,
		private readonly blendAlpha = 0.65,
	) {
		this.episodeSearchService = new EpisodeSearchService(
			this.embedder,
			this.vectorStore,
			this.temporal,
			this.workspacePath,
		)
	}

	public async search(query: string, opts?: SearchOptions): Promise<ConversationFact[]> {
		const qVec = await this.embedder.embed(query)
		const raw = await this.vectorStore.search(query, qVec, opts?.limit ?? 10, opts?.filters as any)
		const scored = raw.map((r) => {
			const fact = r.payload as ConversationFact
			const temporal = this.temporal.score(fact)
			const sim = typeof r.score === "number" ? r.score : 0
			const total = this.blendAlpha * sim + (1 - this.blendAlpha) * temporal
			return { total, rec: r }
		})
		return scored.sort((a, b) => b.total - a.total).map((x) => x.rec.payload as ConversationFact)
	}

	/**
	 * Episode-aware search that groups facts by episode context
	 */
	public async searchEpisodes(query: string, limit: number = 5): Promise<EpisodeSearchResult[]> {
		return this.episodeSearchService.searchByEpisode(query, limit)
	}
}
