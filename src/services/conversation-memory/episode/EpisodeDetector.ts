import { createHash } from "crypto"
import type { Message, ConversationEpisode, ProjectContext, EpisodeConfig, SegmentationMode } from "../types"
import type { IEpisodeDetector, IEpisodeContextGenerator } from "../interfaces/episode"
import type { IEmbedder } from "../interfaces"
import type { ILlmProvider } from "../interfaces"

export class EpisodeDetector implements IEpisodeDetector {
	private readonly timeGapMs: number
	private readonly maxMessages: number
	private readonly topicChangePatterns: RegExp[]
	private readonly mode: SegmentationMode
	private readonly driftK: number
	private readonly minWindow: number
	private readonly distance: "cosine" | "dot"
	private readonly useBoundaryRefiner: boolean

	constructor(
		private readonly contextGenerator: IEpisodeContextGenerator,
		private readonly embedder: IEmbedder | undefined,
		private readonly llm: ILlmProvider | undefined,
		cfg?: EpisodeConfig,
	) {
		this.timeGapMs = (cfg?.timeGapMin ?? 30) * 60 * 1000
		this.maxMessages = cfg?.maxMessages ?? 25
		this.topicChangePatterns = (cfg?.topicPatterns ?? []).map((p) => new RegExp(p, "i"))
		this.mode = cfg?.segmentation?.mode ?? "semantic"
		this.driftK = cfg?.segmentation?.semantic?.driftK ?? 2.5
		this.minWindow = cfg?.segmentation?.semantic?.minWindow ?? 5
		this.distance = cfg?.segmentation?.semantic?.distance ?? "cosine"
		this.useBoundaryRefiner = cfg?.segmentation?.boundaryRefiner ?? this.mode === "llm_verified"
	}

	async detect(
		messages: Message[],
		workspaceId: string,
		projectContext?: ProjectContext,
	): Promise<ConversationEpisode[]> {
		if (messages.length === 0) return []

		// 1) Heuristic candidates: time gap + topic-change
		const heuristicBps = this.findHeuristicBreakpoints(messages)

		// 2) Semantic candidates: centroid drift (if embedder available)
		const semanticBps =
			this.mode !== "heuristic" && this.embedder ? await this.findSemanticBreakpoints(messages) : []

		// Union of candidates
		const candidates = Array.from(new Set([...heuristicBps, ...semanticBps])).sort((a, b) => a - b)

		// 3) Enforce max size and construct preliminary episodes
		const prelim = this.buildEpisodesFromBreakpoints(messages, candidates, workspaceId)

		// 4) Optional LLM boundary refiner
		const refined =
			this.useBoundaryRefiner && this.llm
				? await this.refineBoundariesLLM(messages, prelim, workspaceId, projectContext)
				: prelim

		// 5) Generate context descriptions (LLM-only, no heuristic fallback)
		for (const ep of refined) {
			try {
				ep.context_description = await this.contextGenerator.describe(ep.messages, projectContext)
			} catch (error) {
				// If LLM fails, use a basic description but don't fall back to heuristics
				ep.context_description = `Episode with ${ep.message_count} messages`
				console.error("[EpisodeDetector] Context generation failed:", error)
			}
		}

		return refined
	}

	private findHeuristicBreakpoints(messages: Message[]): number[] {
		const bps = new Set<number>()

		// Time-based breakpoints
		for (let i = 1; i < messages.length; i++) {
			const prev = this.parseTs(messages[i - 1])
			const curr = this.parseTs(messages[i])
			if (curr - prev > this.timeGapMs) bps.add(i)
		}

		// Topic-based (config-driven patterns)
		if (this.topicChangePatterns.length > 0) {
			for (let i = 1; i < messages.length; i++) {
				const content = messages[i].content.toLowerCase()
				if (this.topicChangePatterns.some((rx) => rx.test(content))) bps.add(i)
			}
		}

		return Array.from(bps).sort((a, b) => a - b)
	}

	private async findSemanticBreakpoints(messages: Message[]): Promise<number[]> {
		if (!this.embedder) return []

		const texts = messages.map((m) => m.content)
		const vectors: number[][] = []

		// Generate embeddings for all messages
		for (const text of texts) {
			try {
				const embedding = await this.embedder.embed(text)
				vectors.push(embedding)
			} catch (error) {
				console.error("[EpisodeDetector] Embedding failed for message:", error)
				vectors.push([]) // Empty embedding as fallback
			}
		}

		const bps: number[] = []
		let cluster: number[] | undefined
		const recentDistances: number[] = []

		const dist = (a: number[], b: number[]) =>
			this.distance === "cosine" ? this.cosineDistance(a, b) : this.dotDistance(a, b)

		for (let i = 0; i < vectors.length; i++) {
			const v = vectors[i]
			if (v.length === 0) continue // Skip failed embeddings

			if (!cluster) {
				cluster = v.slice()
				continue
			}

			const d = dist(v, cluster)
			recentDistances.push(d)
			const threshold = this.adaptiveThreshold(recentDistances, this.driftK)

			if (i >= this.minWindow && d > threshold) {
				bps.push(i)
				// Reset cluster for new episode
				cluster = v.slice()
				recentDistances.length = 0
				continue
			}

			// Update centroid (simple running average)
			const n = Math.min(i, 1000) // Cap weight
			for (let j = 0; j < cluster.length; j++) {
				cluster[j] = (cluster[j] * n + v[j]) / (n + 1)
			}
		}

		return bps
	}

	private buildEpisodesFromBreakpoints(
		messages: Message[],
		sortedBps: number[],
		workspaceId: string,
	): ConversationEpisode[] {
		const episodes: ConversationEpisode[] = []
		const bps = sortedBps.slice()
		let start = 0

		const pushEp = (s: number, e: number) => {
			const slice = messages.slice(s, e)
			if (slice.length === 0) return

			const firstTs = this.parseTs(slice[0]) || Date.now()
			const lastTs = this.parseTs(slice[slice.length - 1]) || Date.now()

			episodes.push({
				episode_id: this.makeEpisodeId(slice, workspaceId, firstTs, lastTs),
				workspace_id: workspaceId,
				messages: slice,
				reference_time: new Date(lastTs),
				start_time: new Date(firstTs),
				end_time: new Date(lastTs),
				message_count: slice.length,
				context_description: "Episode detected (pending context)",
			})
		}

		// Insert size-based cuts between candidate bps to enforce maxMessages
		for (const bp of [...bps, messages.length]) {
			while (bp - start > this.maxMessages) {
				const forced = start + this.maxMessages
				pushEp(start, forced)
				start = forced
			}
			pushEp(start, bp)
			start = bp
		}

		return episodes
	}

	private async refineBoundariesLLM(
		messages: Message[],
		prelim: ConversationEpisode[],
		workspaceId: string,
		projectContext?: ProjectContext,
	): Promise<ConversationEpisode[]> {
		if (!this.llm) return prelim

		try {
			const convo = messages.map((m, i) => ({
				i,
				role: m.role,
				t: m.timestamp,
				c: this.truncate(m.content, 400),
			}))

			const prompt = `You will segment a technical chat into coherent episodes.
Return JSON: { "boundaries": number[], "titles": string[] }
Rules: boundaries are 0-based message indices where a new episode begins; must include 0; keep episodes <= ${this.maxMessages} messages; prefer merging trivial one-liners into neighbors; minimize splits unless topic clearly shifts.
Project: ${projectContext?.workspaceName || ""} (${projectContext?.language || "unknown"}${projectContext?.framework ? " / " + projectContext.framework : ""})
Messages: ${JSON.stringify(convo)}`

			const raw = await this.llm.generateJson(prompt, { temperature: 0.2, max_tokens: 500 })
			const boundaries: number[] = Array.isArray(raw?.boundaries) ? raw.boundaries : [0]
			const titles: string[] = Array.isArray(raw?.titles) ? raw.titles : []

			// Sanitize boundaries
			const bps = Array.from(
				new Set([0, ...boundaries.filter((x) => Number.isInteger(x) && x >= 0 && x < messages.length)]),
			).sort((a, b) => a - b)

			const refined = this.buildEpisodesFromBreakpoints(messages, bps.slice(1), workspaceId)
			// Attach titles if provided
			refined.forEach((ep, idx) => {
				if (titles[idx]) ep.context_description = titles[idx]
			})
			return refined
		} catch (error) {
			console.error("[EpisodeDetector] LLM boundary refinement failed:", error)
			return prelim
		}
	}

	private parseTs(m: Message): number {
		return m.timestamp ? new Date(m.timestamp).getTime() : 0
	}

	private makeEpisodeId(slice: Message[], ws: string, firstTs: number, _lastTs: number): string {
		// Stabilize episode IDs for the entire lifetime of the episode by anchoring
		// the fingerprint to the first message content and the start time only.
		// This keeps the ID consistent as the episode grows across turns.
		const firstContent = (slice[0]?.content || "").slice(0, 120)
		const fingerprint = `${firstContent}|${firstTs}`
		const hash = createHash("sha256").update(ws).update(fingerprint).digest("hex").slice(0, 10)
		return `ep_${hash}`
	}

	private cosineDistance(a: number[], b: number[]): number {
		let dot = 0,
			na = 0,
			nb = 0
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i]
			na += a[i] * a[i]
			nb += b[i] * b[i]
		}
		if (na === 0 || nb === 0) return 1
		return 1 - dot / (Math.sqrt(na) * Math.sqrt(nb))
	}

	private dotDistance(a: number[], b: number[]): number {
		let dot = 0
		for (let i = 0; i < a.length; i++) dot += a[i] * b[i]
		return Math.max(0, 1 - dot)
	}

	private median(xs: number[]): number {
		if (xs.length === 0) return 0
		const s = [...xs].sort((a, b) => a - b)
		const mid = Math.floor(s.length / 2)
		return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
	}

	private adaptiveThreshold(values: number[], k: number): number {
		if (values.length < 3) return Infinity // Avoid early splits
		const med = this.median(values)
		const deviations = values.map((v) => Math.abs(v - med))
		const mad = this.median(deviations) || 1e-6
		return med + k * mad
	}

	private truncate(s: string, n: number): string {
		return s.length > n ? s.slice(0, n) + "…" : s
	}
}
