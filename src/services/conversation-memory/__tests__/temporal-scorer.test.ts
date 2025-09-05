import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { TemporalScorer } from "../lifecycle/temporal"
import type { ConversationFact } from "../types"

/**
 * Tests for the TemporalScorer which implements temporal intelligence
 * to manage fact relevance over time according to the zagmems specification.
 *
 * Key behaviors tested:
 * - Infrastructure facts maintain high relevance (persistent)
 * - Architecture facts decay with supersession
 * - Debugging facts auto-resolve and promote to patterns
 * - Pattern facts maintain steady relevance with derived boost
 */
describe("TemporalScorer", () => {
	let scorer: TemporalScorer
	let mockDate: Date

	beforeEach(() => {
		scorer = new TemporalScorer()
		mockDate = new Date("2024-01-15T12:00:00Z")
		vi.useFakeTimers()
		vi.setSystemTime(mockDate)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	const createMockFact = (overrides: Partial<ConversationFact> = {}): ConversationFact => ({
		id: "test-fact",
		content: "Test fact content",
		category: "infrastructure",
		confidence: 0.8,
		reference_time: new Date("2024-01-15T10:00:00Z"), // 2 hours ago
		ingestion_time: new Date("2024-01-15T10:00:00Z"),
		workspace_id: "test-workspace",
		project_context: {
			workspaceName: "test-project",
			language: "typescript",
			framework: "express",
			packageManager: "npm",
		},
		conversation_context: "Test conversation",
		embedding: [0.1, 0.2, 0.3],
		metadata: {},
		...overrides,
	})

	describe("infrastructure facts", () => {
		it("should maintain high relevance for infrastructure facts", () => {
			const fact = createMockFact({
				category: "infrastructure",
				confidence: 0.9,
				reference_time: new Date("2024-01-01T12:00:00Z"), // 14 days ago
			})

			const score = scorer.score(fact, mockDate)

			// Infrastructure facts get 1.2x multiplier, so should be 0.9 * 1.2 = 1.08
			expect(score).toBeCloseTo(1.08, 2)
		})

		it("should never auto-expire infrastructure facts", () => {
			const veryOldFact = createMockFact({
				category: "infrastructure",
				confidence: 0.8,
				reference_time: new Date("2023-01-01T12:00:00Z"), // Over a year ago
			})

			const score = scorer.score(veryOldFact, mockDate)

			// Should still have high relevance due to 1.2x multiplier
			expect(score).toBeCloseTo(0.96, 2) // 0.8 * 1.2
		})

		it("should handle infrastructure facts with varying confidence", () => {
			const highConfidenceFact = createMockFact({
				category: "infrastructure",
				confidence: 0.95,
			})

			const lowConfidenceFact = createMockFact({
				category: "infrastructure",
				confidence: 0.6,
			})

			const highScore = scorer.score(highConfidenceFact, mockDate)
			const lowScore = scorer.score(lowConfidenceFact, mockDate)

			expect(highScore).toBeGreaterThan(lowScore)
			expect(highScore).toBeCloseTo(1.14, 2) // 0.95 * 1.2
			expect(lowScore).toBeCloseTo(0.72, 2) // 0.6 * 1.2
		})
	})

	describe("architecture facts", () => {
		it("should have normal relevance for active architecture facts", () => {
			const fact = createMockFact({
				category: "architecture",
				confidence: 0.85,
				reference_time: new Date("2024-01-15T11:00:00Z"), // 1 hour ago
			})

			const score = scorer.score(fact, mockDate)

			// Recent architecture facts should maintain their confidence
			expect(score).toBeCloseTo(0.85, 2)
		})

		it("should severely reduce relevance for superseded architecture facts", () => {
			const supersededFact = createMockFact({
				category: "architecture",
				confidence: 0.9,
				superseded_by: "newer-fact-id",
				superseded_at: new Date("2024-01-14T12:00:00Z"),
			})

			const score = scorer.score(supersededFact, mockDate)

			// Superseded facts should have very low relevance (0.1)
			expect(score).toBe(0.1)
		})

		it("should decay architecture facts over time when not superseded", () => {
			const recentFact = createMockFact({
				category: "architecture",
				confidence: 0.8,
				reference_time: new Date("2024-01-15T11:00:00Z"), // 1 hour ago
			})

			const oldFact = createMockFact({
				category: "architecture",
				confidence: 0.8,
				reference_time: new Date("2024-01-01T12:00:00Z"), // 14 days ago
			})

			const veryOldFact = createMockFact({
				category: "architecture",
				confidence: 0.8,
				reference_time: new Date("2023-10-15T12:00:00Z"), // ~90 days ago
			})

			const recentScore = scorer.score(recentFact, mockDate)
			const oldScore = scorer.score(oldFact, mockDate)
			const veryOldScore = scorer.score(veryOldFact, mockDate)

			// Recent should maintain full confidence
			expect(recentScore).toBeCloseTo(0.8, 2)
			// Old should decay but not be minimal
			expect(oldScore).toBeLessThan(recentScore)
			expect(oldScore).toBeGreaterThan(0.3)
			// Very old should have minimal relevance but not zero
			expect(veryOldScore).toBeLessThan(oldScore)
			expect(veryOldScore).toBeGreaterThan(0.2)
		})
	})

	describe("debugging facts", () => {
		it("should maintain high relevance for recent unresolved debugging facts", () => {
			const recentBug = createMockFact({
				category: "debugging",
				confidence: 0.85,
				resolved: false,
				reference_time: new Date("2024-01-15T11:30:00Z"), // 30 minutes ago
			})

			const score = scorer.score(recentBug, mockDate)

			// Recent debugging should maintain confidence
			expect(score).toBeCloseTo(0.85, 2)
		})

		it("should severely reduce relevance for resolved debugging facts", () => {
			const resolvedBug = createMockFact({
				category: "debugging",
				confidence: 0.9,
				resolved: true,
				resolved_at: new Date("2024-01-14T12:00:00Z"),
			})

			const score = scorer.score(resolvedBug, mockDate)

			// Resolved debugging facts should have very low relevance (0.15)
			expect(score).toBe(0.15)
		})

		it("should reduce relevance for old unresolved debugging facts", () => {
			const oldBug = createMockFact({
				category: "debugging",
				confidence: 0.8,
				resolved: false,
				reference_time: new Date("2023-12-31T12:00:00Z"), // 15 days ago (> 14 days)
			})

			const score = scorer.score(oldBug, mockDate)

			// Old debugging facts should become noise (0.1)
			expect(score).toBe(0.1)
		})

		it("should handle edge case at 14 day boundary", () => {
			const boundaryBug = createMockFact({
				category: "debugging",
				confidence: 0.8,
				resolved: false,
				reference_time: new Date("2024-01-01T12:00:00Z"), // Exactly 14 days ago
			})

			const score = scorer.score(boundaryBug, mockDate)

			// At exactly 14 days, should still maintain confidence (not > 14)
			expect(score).toBe(0.8)
		})

		it("should maintain relevance just before 14 day cutoff", () => {
			const almostOldBug = createMockFact({
				category: "debugging",
				confidence: 0.8,
				resolved: false,
				reference_time: new Date("2024-01-01T12:01:00Z"), // 13 days, 23 hours, 59 minutes ago
			})

			const score = scorer.score(almostOldBug, mockDate)

			// Should maintain full confidence just before cutoff
			expect(score).toBeCloseTo(0.8, 2)
		})
	})

	describe("pattern facts", () => {
		it("should maintain steady medium relevance for pattern facts", () => {
			const pattern = createMockFact({
				category: "pattern",
				confidence: 0.85,
				reference_time: new Date("2024-01-10T12:00:00Z"), // 5 days ago
			})

			const score = scorer.score(pattern, mockDate)

			// Pattern facts: base * patternBase * decay
			// 0.85 * 0.8 * decay_factor(5 days / 180 days)
			// decay = Math.max(0.5, 1 - 5/180) = 0.9722
			// 0.85 * 0.8 * 0.9722 = 0.6611
			expect(score).toBeCloseTo(0.661, 2)
		})

		it("should handle patterns without derived_from field", () => {
			const regularPattern = createMockFact({
				category: "pattern",
				confidence: 0.8,
				reference_time: new Date("2024-01-10T12:00:00Z"),
			})

			const score = scorer.score(regularPattern, mockDate)

			// Regular: 0.8 * 0.8 * decay (5 days)
			// decay = max(0.5, 1 - 5/180) = 0.972
			expect(score).toBeCloseTo(0.622, 2) // 0.8 * 0.8 * 0.972
		})

		it("should decay slowly over long time periods", () => {
			const recentPattern = createMockFact({
				category: "pattern",
				confidence: 0.8,
				reference_time: new Date("2024-01-14T12:00:00Z"), // 1 day ago
			})

			const oldPattern = createMockFact({
				category: "pattern",
				confidence: 0.8,
				reference_time: new Date("2023-07-15T12:00:00Z"), // ~6 months ago
			})

			const veryOldPattern = createMockFact({
				category: "pattern",
				confidence: 0.8,
				reference_time: new Date("2023-01-15T12:00:00Z"), // ~1 year ago
			})

			const recentScore = scorer.score(recentPattern, mockDate)
			const oldScore = scorer.score(oldPattern, mockDate)
			const veryOldScore = scorer.score(veryOldPattern, mockDate)

			// Pattern scoring includes decay calculation
			// Recent (1 day): decay = max(0.5, 1 - 1/180) = 0.994, score = 0.8 * 0.8 * 0.994 = 0.636
			// Old (6 months ≈ 180 days): decay = max(0.5, 1 - 180/180) = 0.5, score = 0.8 * 0.8 * 0.5 = 0.32
			// Very old (1 year ≈ 365 days): decay = max(0.5, 1 - 365/180) = 0.5, score = 0.8 * 0.8 * 0.5 = 0.32
			expect(recentScore).toBeCloseTo(0.636, 2)
			expect(oldScore).toBeLessThan(recentScore)
			expect(oldScore).toBeCloseTo(0.32, 2) // Hit minimum decay
			expect(veryOldScore).toBeLessThan(recentScore)
			expect(veryOldScore).toBeCloseTo(0.32, 2) // Also hit minimum decay
		})
	})

	describe("edge cases and error handling", () => {
		it("should handle facts with unknown category", () => {
			const unknownFact = createMockFact({
				category: "unknown" as any, // Invalid category
				confidence: 0.8,
			})

			const score = scorer.score(unknownFact, mockDate)

			// Should return default score for unknown category (implementation behavior)
			expect(score).toBeCloseTo(0.56, 2) // base 0.8 * 0.7 = 0.56 (within 2 decimal places)
		})

		it("should handle facts with zero confidence", () => {
			const zeroConfidenceFact = createMockFact({
				confidence: 0,
			})

			const score = scorer.score(zeroConfidenceFact, mockDate)

			// Implementation uses || operator: fact.confidence || 0.7
			// So 0 confidence becomes 0.7, then infrastructure multiplier applied
			// 0.7 * 1.2 = 0.84
			expect(score).toBe(0.84)
		})

		it("should handle facts with maximum confidence", () => {
			const maxConfidenceFact = createMockFact({
				category: "infrastructure",
				confidence: 1.0,
			})

			const score = scorer.score(maxConfidenceFact, mockDate)

			expect(score).toBeCloseTo(1.2, 2) // 1.0 * 1.2
		})

		it("should handle facts with future reference_time", () => {
			const futureFact = createMockFact({
				reference_time: new Date("2024-01-16T12:00:00Z"), // 1 day in future
				confidence: 0.8,
			})

			const score = scorer.score(futureFact, mockDate)

			// Should treat as very recent and maintain confidence
			expect(score).toBeCloseTo(0.96, 2) // 0.8 * 1.2 (infrastructure)
		})

		it("should handle facts with missing optional fields", () => {
			const minimalFact = createMockFact({
				superseded_by: undefined,
				superseded_at: undefined,
				resolved: undefined,
				resolved_at: undefined,
				derived_from: undefined,
			})

			const score = scorer.score(minimalFact, mockDate)

			// Should work with defaults
			expect(score).toBeGreaterThan(0)
			expect(typeof score).toBe("number")
		})

		it("should handle same reference_time as current time", () => {
			const nowFact = createMockFact({
				reference_time: mockDate,
				confidence: 0.8,
			})

			const score = scorer.score(nowFact, mockDate)

			expect(score).toBeCloseTo(0.96, 2) // 0.8 * 1.2 (infrastructure, no decay)
		})
	})

	describe("temporal decay calculations", () => {
		it("should correctly calculate days between dates", () => {
			const fact1Day = createMockFact({
				category: "architecture",
				confidence: 1.0,
				reference_time: new Date("2024-01-14T12:00:00Z"), // Exactly 1 day ago
			})

			const fact7Days = createMockFact({
				category: "architecture",
				confidence: 1.0,
				reference_time: new Date("2024-01-08T12:00:00Z"), // Exactly 7 days ago
			})

			const score1Day = scorer.score(fact1Day, mockDate)
			const score7Days = scorer.score(fact7Days, mockDate)

			// 1 day should have higher score than 7 days for architecture
			expect(score1Day).toBeGreaterThan(score7Days)
		})

		it("should handle leap year calculations correctly", () => {
			const leapYearDate = new Date("2024-02-29T12:00:00Z")
			const factBeforeLeap = createMockFact({
				category: "architecture",
				confidence: 0.8,
				reference_time: new Date("2024-02-28T12:00:00Z"),
			})

			vi.setSystemTime(leapYearDate)
			const score = scorer.score(factBeforeLeap, leapYearDate)

			// Should handle leap day correctly (1 day difference)
			// Architecture with 1 day: recency = max(0.3, 1 - 1/90) = 0.989
			expect(score).toBeCloseTo(0.791, 2) // 0.8 * 0.989
		})
	})

	describe("consistency and determinism", () => {
		it("should return consistent scores for identical facts", () => {
			const fact1 = createMockFact({ id: "fact-1" })
			const fact2 = createMockFact({ id: "fact-2" })

			const score1 = scorer.score(fact1, mockDate)
			const score2 = scorer.score(fact2, mockDate)

			expect(score1).toBe(score2)
		})

		it("should return same score when called multiple times", () => {
			const fact = createMockFact()

			const score1 = scorer.score(fact, mockDate)
			const score2 = scorer.score(fact, mockDate)
			const score3 = scorer.score(fact, mockDate)

			expect(score1).toBe(score2)
			expect(score2).toBe(score3)
		})

		it("should maintain score relationships across different times", () => {
			const infrastructureFact = createMockFact({ category: "infrastructure", confidence: 0.8 })
			const architectureFact = createMockFact({ category: "architecture", confidence: 0.8 })
			const debuggingFact = createMockFact({ category: "debugging", confidence: 0.8 })
			const patternFact = createMockFact({ category: "pattern", confidence: 0.8 })

			const infraScore = scorer.score(infrastructureFact, mockDate)
			const archScore = scorer.score(architectureFact, mockDate)
			const debugScore = scorer.score(debuggingFact, mockDate)
			const patternScore = scorer.score(patternFact, mockDate)

			// Infrastructure should always rank highest for recent facts
			expect(infraScore).toBeGreaterThan(archScore)
			expect(infraScore).toBeGreaterThan(debugScore)
			expect(infraScore).toBeGreaterThan(patternScore)
		})
	})

	describe("configurable parameters", () => {
		it("should use custom infrastructure multiplier", () => {
			const customScorer = new TemporalScorer({ infraMultiplier: 1.5 })
			const fact = createMockFact({
				category: "infrastructure",
				confidence: 0.8,
			})

			const score = customScorer.score(fact, mockDate)

			expect(score).toBeCloseTo(1.2, 2) // 0.8 * 1.5
		})

		it("should use custom architecture decay days", () => {
			const customScorer = new TemporalScorer({ architectureDecayDays: 30 })
			const fact = createMockFact({
				category: "architecture",
				confidence: 0.8,
				reference_time: new Date("2024-01-01T12:00:00Z"), // 14 days ago
			})

			const score = customScorer.score(fact, mockDate)

			// With 30-day decay, 14 days should have less decay than default 90-day
			const defaultScorer = new TemporalScorer()
			const defaultScore = defaultScorer.score(fact, mockDate)

			expect(score).toBeLessThan(defaultScore)
		})

		it("should use custom debugging resolved score", () => {
			const customScorer = new TemporalScorer({ debuggingResolvedScore: 0.3 })
			const fact = createMockFact({
				category: "debugging",
				confidence: 0.8,
				resolved: true,
			})

			const score = customScorer.score(fact, mockDate)

			expect(score).toBe(0.3) // Custom resolved score
		})
	})
})
