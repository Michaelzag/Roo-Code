import type { ConversationFact } from "../types"

export class TemporalScorer {
	constructor(
		private readonly cfg: {
			infraMultiplier?: number
			architectureDecayDays?: number
			debuggingResolvedScore?: number
			debuggingOldDays?: number
			patternDecayDays?: number
			patternBase?: number
		} = {},
	) {}

	private daysBetween(a?: Date, b?: Date): number {
		if (!a || !b) return 0
		const ms = Math.abs((b as any) - (a as any))
		return ms / (1000 * 60 * 60 * 24)
	}

	public score(fact: ConversationFact, now = new Date()): number {
		const base = fact.confidence || 0.7
		switch (fact.category) {
			case "infrastructure":
				return base * (this.cfg.infraMultiplier ?? 1.2)
			case "architecture": {
				if (fact.superseded_by) return 0.1
				const days = this.daysBetween(fact.reference_time, now)
				const decayDays = this.cfg.architectureDecayDays ?? 90
				const recency = Math.max(0.3, 1 - days / decayDays)
				return base * recency
			}
			case "debugging": {
				if (fact.resolved) return this.cfg.debuggingResolvedScore ?? 0.15
				const days = this.daysBetween(fact.reference_time, now)
				return days > (this.cfg.debuggingOldDays ?? 14) ? 0.1 : base
			}
			case "pattern": {
				const days = this.daysBetween(fact.reference_time, now)
				const decayDays = this.cfg.patternDecayDays ?? 180
				const decay = Math.max(0.5, 1 - days / decayDays)
				return base * (this.cfg.patternBase ?? 0.8) * decay
			}
		}
	}
}
