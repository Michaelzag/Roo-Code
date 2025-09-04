import type { ConversationFact, EpisodeSearchResult, ProjectContext } from "../../types"
import type { IEmbedder, IVectorStore, VectorRecord } from "../../interfaces"
import { EpisodeSearchService } from "../EpisodeSearchService"
import { TemporalScorer } from "../../lifecycle/temporal"

/**
 * Comprehensive unit tests for EpisodeSearchService class
 *
 * Test Coverage Areas:
 * 1. Core Search Operation Tests (10 tests): Vector search, embedding, workspace filtering
 * 2. Episode Grouping Tests (6 tests): Episode ID grouping, fact organization
 * 3. Ranking Algorithm Tests (8 tests): Relevance scoring, result ordering, coherence bonus
 * 4. Filter Integration Tests (6 tests): Workspace filtering, search parameters
 * 5. Timeframe Formatting Tests (6 tests): Date handling, range formatting
 * 6. Error Handling Tests (6 tests): Network failures, empty results, malformed data
 *
 * Total: 42 comprehensive test cases for 100% coverage
 */
describe("EpisodeSearchService", () => {
	let mockEmbedder: IEmbedder
	let mockVectorStore: IVectorStore
	let mockTemporalScorer: TemporalScorer
	let service: EpisodeSearchService
	const testWorkspacePath = "/test/workspace"

	// Test data factories
	const createTestFact = (overrides: Partial<ConversationFact> = {}): ConversationFact => ({
		id: "fact-1",
		content: "Test fact content",
		category: "architecture",
		confidence: 0.8,
		reference_time: new Date("2024-01-15T10:00:00Z"),
		ingestion_time: new Date("2024-01-15T10:05:00Z"),
		workspace_id: "workspace-1",
		workspace_path: testWorkspacePath,
		project_context: {
			workspaceName: "test-project",
			language: "typescript",
			framework: "react",
			packageManager: "npm",
		},
		conversation_context: "User discussing architecture patterns",
		episode_id: "episode-1",
		episode_context: "Architecture discussion episode",
		embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
		metadata: {},
		...overrides,
	})

	const createVectorRecord = (fact: ConversationFact, score: number = 0.9): VectorRecord<ConversationFact> => ({
		id: fact.id,
		vector: fact.embedding,
		payload: fact,
		score,
	})

	beforeEach(() => {
		// Setup embedder mock
		mockEmbedder = {
			embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
			embedBatch: vi.fn(),
			dimension: 5,
		}

		// Setup vector store mock
		mockVectorStore = {
			ensureCollection: vi.fn(),
			collectionName: vi.fn().mockReturnValue("test-collection"),
			upsert: vi.fn(),
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			get: vi.fn(),
			search: vi.fn().mockResolvedValue([]),
			filter: vi.fn(),
		}

		// Setup temporal scorer mock
		mockTemporalScorer = new TemporalScorer()

		// Create service instance
		service = new EpisodeSearchService(mockEmbedder, mockVectorStore, mockTemporalScorer, testWorkspacePath)
	})

	describe("Core Search Operations", () => {
		it("should perform basic episode search with query embedding", async () => {
			const testQuery = "architecture patterns"
			const testFact = createTestFact()
			const vectorResults = [createVectorRecord(testFact)]

			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode(testQuery)

			expect(mockEmbedder.embed).toHaveBeenCalledWith(testQuery)
			expect(mockVectorStore.search).toHaveBeenCalledWith(testQuery, [0.1, 0.2, 0.3, 0.4, 0.5], 50, {
				workspace_path: testWorkspacePath,
			})
			expect(results).toHaveLength(1)
			expect(results[0].episode_id).toBe("episode-1")
		})

		it("should use workspace path for filtering in vector search", async () => {
			await service.searchByEpisode("test query")

			expect(mockVectorStore.search).toHaveBeenCalledWith(expect.any(String), expect.any(Array), 50, {
				workspace_path: testWorkspacePath,
			})
		})

		it("should request 50 results from vector store for episode grouping", async () => {
			await service.searchByEpisode("test query")

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Array),
				50,
				expect.any(Object),
			)
		})

		it("should handle custom limit parameter correctly", async () => {
			const facts = Array.from({ length: 8 }, (_, i) =>
				createTestFact({
					id: `fact-${i}`,
					episode_id: `episode-${i}`,
					confidence: 0.9 - i * 0.1,
				}),
			)
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query", 3)

			expect(results).toHaveLength(3)
		})

		it("should handle empty vector store results gracefully", async () => {
			mockVectorStore.search = vi.fn().mockResolvedValue([])

			const results = await service.searchByEpisode("test query")

			expect(results).toHaveLength(0)
			expect(results).toEqual([])
		})

		it("should propagate embedder errors", async () => {
			const embedError = new Error("Embedding service unavailable")
			mockEmbedder.embed = vi.fn().mockRejectedValue(embedError)

			await expect(service.searchByEpisode("test query")).rejects.toThrow("Embedding service unavailable")
		})

		it("should propagate vector store search errors", async () => {
			const searchError = new Error("Vector store connection failed")
			mockVectorStore.search = vi.fn().mockRejectedValue(searchError)

			await expect(service.searchByEpisode("test query")).rejects.toThrow("Vector store connection failed")
		})

		it("should handle large result sets efficiently", async () => {
			const facts = Array.from({ length: 100 }, (_, i) =>
				createTestFact({
					id: `fact-${i}`,
					episode_id: `episode-${Math.floor(i / 10)}`, // 10 episodes with 10 facts each
				}),
			)
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const startTime = Date.now()
			const results = await service.searchByEpisode("test query", 5)
			const endTime = Date.now()

			expect(results).toHaveLength(5)
			expect(endTime - startTime).toBeLessThan(100) // Should complete quickly
		})

		it("should handle facts without episode_id by using 'unknown' grouping", async () => {
			const factWithoutEpisodeId = createTestFact({ episode_id: undefined })
			const vectorResults = [createVectorRecord(factWithoutEpisodeId)]
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results).toHaveLength(1)
			expect(results[0].episode_id).toBe("unknown")
		})

		it("should handle default limit when no limit specified", async () => {
			const facts = Array.from({ length: 10 }, (_, i) =>
				createTestFact({ id: `fact-${i}`, episode_id: `episode-${i}` }),
			)
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results).toHaveLength(5) // Default limit should be 5
		})
	})

	describe("Episode Grouping Logic", () => {
		it("should group facts by episode_id correctly", async () => {
			const factsEpisode1 = [
				createTestFact({ id: "fact-1", episode_id: "episode-1" }),
				createTestFact({ id: "fact-2", episode_id: "episode-1" }),
			]
			const factsEpisode2 = [createTestFact({ id: "fact-3", episode_id: "episode-2" })]
			const allFacts = [...factsEpisode1, ...factsEpisode2]
			const vectorResults = allFacts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results).toHaveLength(2)
			const episode1Result = results.find((r) => r.episode_id === "episode-1")
			const episode2Result = results.find((r) => r.episode_id === "episode-2")

			expect(episode1Result?.fact_count).toBe(2)
			expect(episode2Result?.fact_count).toBe(1)
		})

		it("should handle multiple facts with same episode_id from vector results", async () => {
			const facts = Array.from({ length: 5 }, (_, i) =>
				createTestFact({ id: `fact-${i}`, episode_id: "episode-shared" }),
			)
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results).toHaveLength(1)
			expect(results[0].episode_id).toBe("episode-shared")
			expect(results[0].fact_count).toBe(5)
			expect(results[0].facts).toHaveLength(5)
		})

		it("should preserve episode context from first fact in group", async () => {
			const facts = [
				createTestFact({
					id: "fact-1",
					episode_id: "episode-1",
					episode_context: "Primary context",
				}),
				createTestFact({
					id: "fact-2",
					episode_id: "episode-1",
					episode_context: "Secondary context",
				}),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].episode_context).toBe("Primary context")
		})

		it("should use fallback context when episode_context is missing", async () => {
			const factWithoutContext = createTestFact({
				episode_id: "episode-1",
				episode_context: undefined,
			})
			const vectorResults = [createVectorRecord(factWithoutContext)]
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].episode_context).toBe("Episode context unavailable")
		})

		it("should sort facts within episodes by confidence descending", async () => {
			const facts = [
				createTestFact({ id: "fact-1", episode_id: "episode-1", confidence: 0.6 }),
				createTestFact({ id: "fact-2", episode_id: "episode-1", confidence: 0.9 }),
				createTestFact({ id: "fact-3", episode_id: "episode-1", confidence: 0.7 }),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			const sortedFacts = results[0].facts
			expect(sortedFacts[0].confidence).toBe(0.9)
			expect(sortedFacts[1].confidence).toBe(0.7)
			expect(sortedFacts[2].confidence).toBe(0.6)
		})

		it("should handle facts with null or undefined episode_id consistently", async () => {
			const facts = [
				createTestFact({ id: "fact-1", episode_id: null as any }),
				createTestFact({ id: "fact-2", episode_id: undefined }),
				createTestFact({ id: "fact-3", episode_id: "" }),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			// All should be grouped under "unknown"
			expect(results).toHaveLength(1)
			expect(results[0].episode_id).toBe("unknown")
			expect(results[0].fact_count).toBe(3)
		})
	})

	describe("Ranking Algorithm Tests", () => {
		it("should calculate episode relevance based on average fact confidence", async () => {
			const facts = [
				createTestFact({ id: "fact-1", episode_id: "episode-1", confidence: 0.8 }),
				createTestFact({ id: "fact-2", episode_id: "episode-1", confidence: 0.6 }),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			// Average confidence: (0.8 + 0.6) / 2 = 0.7
			expect(results[0].relevance_score).toBeCloseTo(0.7)
		})

		it("should apply coherence bonus for episodes with more than 3 facts", async () => {
			const factsLargeEpisode = Array.from({ length: 5 }, (_, i) =>
				createTestFact({
					id: `fact-large-${i}`,
					episode_id: "episode-large",
					confidence: 0.7,
				}),
			)
			const factsSmallEpisode = Array.from({ length: 2 }, (_, i) =>
				createTestFact({
					id: `fact-small-${i}`,
					episode_id: "episode-small",
					confidence: 0.7,
				}),
			)
			const allFacts = [...factsLargeEpisode, ...factsSmallEpisode]
			const vectorResults = allFacts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			const largeEpisode = results.find((r) => r.episode_id === "episode-large")
			const smallEpisode = results.find((r) => r.episode_id === "episode-small")

			expect(largeEpisode?.relevance_score).toBeCloseTo(0.8) // 0.7 + 0.1 bonus
			expect(smallEpisode?.relevance_score).toBeCloseTo(0.7) // 0.7 + 0 bonus
		})

		it("should sort episodes by relevance score descending", async () => {
			const episodes = [
				{ id: "episode-low", confidence: 0.5 },
				{ id: "episode-high", confidence: 0.9 },
				{ id: "episode-medium", confidence: 0.7 },
			]
			const facts = episodes.map((ep) =>
				createTestFact({
					id: `fact-${ep.id}`,
					episode_id: ep.id,
					confidence: ep.confidence,
				}),
			)
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].episode_id).toBe("episode-high")
			expect(results[1].episode_id).toBe("episode-medium")
			expect(results[2].episode_id).toBe("episode-low")
		})

		it("should handle episodes with equal relevance scores consistently", async () => {
			const facts = [
				createTestFact({ id: "fact-1", episode_id: "episode-1", confidence: 0.8 }),
				createTestFact({ id: "fact-2", episode_id: "episode-2", confidence: 0.8 }),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results).toHaveLength(2)
			expect(results[0].relevance_score).toBe(results[1].relevance_score)
		})

		it("should handle single fact episodes correctly", async () => {
			const singleFact = createTestFact({ confidence: 0.85 })
			const vectorResults = [createVectorRecord(singleFact)]
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].relevance_score).toBeCloseTo(0.85) // Just the confidence, no bonus
			expect(results[0].fact_count).toBe(1)
		})

		it("should handle zero confidence facts", async () => {
			const zeroConfidenceFact = createTestFact({ confidence: 0 })
			const vectorResults = [createVectorRecord(zeroConfidenceFact)]
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].relevance_score).toBe(0)
		})

		it("should respect limit parameter for final results", async () => {
			const facts = Array.from({ length: 10 }, (_, i) =>
				createTestFact({
					id: `fact-${i}`,
					episode_id: `episode-${i}`,
					confidence: 0.9 - i * 0.05, // Descending confidence
				}),
			)
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query", 3)

			expect(results).toHaveLength(3)
			// Should be the top 3 by relevance
			expect(results[0].relevance_score).toBeGreaterThan(results[1].relevance_score)
			expect(results[1].relevance_score).toBeGreaterThan(results[2].relevance_score)
		})

		it("should handle coherence bonus calculation with exactly 4 facts", async () => {
			const facts = Array.from({ length: 4 }, (_, i) =>
				createTestFact({
					id: `fact-${i}`,
					episode_id: "episode-boundary",
					confidence: 0.6,
				}),
			)
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].relevance_score).toBe(0.7) // 0.6 + 0.1 bonus for > 3 facts
		})
	})

	describe("Timeframe Formatting Tests", () => {
		it("should format single day timeframe correctly", async () => {
			const sameDay = new Date("2024-01-15T10:00:00Z")
			const facts = [
				createTestFact({ id: "fact-1", reference_time: sameDay }),
				createTestFact({ id: "fact-2", reference_time: new Date("2024-01-15T15:30:00Z") }),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].timeframe).toBe(sameDay.toLocaleDateString())
		})

		it("should format date range timeframe correctly", async () => {
			const startDate = new Date("2024-01-15T10:00:00Z")
			const endDate = new Date("2024-01-18T14:30:00Z")
			const facts = [
				createTestFact({ id: "fact-1", reference_time: startDate }),
				createTestFact({ id: "fact-2", reference_time: endDate }),
				createTestFact({ id: "fact-3", reference_time: new Date("2024-01-16T12:00:00Z") }),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			const expectedTimeframe = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
			expect(results[0].timeframe).toBe(expectedTimeframe)
		})

		it("should handle ISO string dates in reference_time", async () => {
			const fact = createTestFact({
				id: "fact-1",
				reference_time: "2024-01-15T10:00:00Z" as any, // Simulate string date
			})
			const vectorResults = [createVectorRecord(fact)]
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			const expectedDate = new Date("2024-01-15T10:00:00Z")
			expect(results[0].timeframe).toBe(expectedDate.toLocaleDateString())
		})

		it("should handle empty facts array gracefully", async () => {
			// This would be handled at the grouping level, but test the private method behavior
			mockVectorStore.search = vi.fn().mockResolvedValue([])

			const results = await service.searchByEpisode("test query")

			expect(results).toHaveLength(0)
		})

		it("should sort dates correctly for timeframe calculation", async () => {
			const facts = [
				createTestFact({ id: "fact-1", reference_time: new Date("2024-01-18T10:00:00Z") }),
				createTestFact({ id: "fact-2", reference_time: new Date("2024-01-15T10:00:00Z") }),
				createTestFact({ id: "fact-3", reference_time: new Date("2024-01-20T10:00:00Z") }),
			]
			const vectorResults = facts.map((fact) => createVectorRecord(fact))
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			const startDate = new Date("2024-01-15T10:00:00Z")
			const endDate = new Date("2024-01-20T10:00:00Z")
			const expectedTimeframe = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`
			expect(results[0].timeframe).toBe(expectedTimeframe)
		})

		it("should handle single fact timeframe", async () => {
			const singleDate = new Date("2024-01-15T10:00:00Z")
			const fact = createTestFact({ reference_time: singleDate })
			const vectorResults = [createVectorRecord(fact)]
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			const results = await service.searchByEpisode("test query")

			expect(results[0].timeframe).toBe(singleDate.toLocaleDateString())
		})
	})

	describe("Filter Integration Tests", () => {
		it("should pass workspace_path filter to vector store", async () => {
			await service.searchByEpisode("test query")

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Array),
				expect.any(Number),
				{ workspace_path: testWorkspacePath },
			)
		})

		it("should handle different workspace paths correctly", async () => {
			const differentWorkspace = "/different/workspace"
			const serviceWithDifferentWorkspace = new EpisodeSearchService(
				mockEmbedder,
				mockVectorStore,
				mockTemporalScorer,
				differentWorkspace,
			)

			await serviceWithDifferentWorkspace.searchByEpisode("test query")

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Array),
				expect.any(Number),
				{ workspace_path: differentWorkspace },
			)
		})

		it("should maintain workspace isolation between searches", async () => {
			const workspace1 = "/workspace1"
			const workspace2 = "/workspace2"

			const service1 = new EpisodeSearchService(mockEmbedder, mockVectorStore, mockTemporalScorer, workspace1)
			const service2 = new EpisodeSearchService(mockEmbedder, mockVectorStore, mockTemporalScorer, workspace2)

			await service1.searchByEpisode("query1")
			await service2.searchByEpisode("query2")

			expect(mockVectorStore.search).toHaveBeenNthCalledWith(1, "query1", expect.any(Array), 50, {
				workspace_path: workspace1,
			})
			expect(mockVectorStore.search).toHaveBeenNthCalledWith(2, "query2", expect.any(Array), 50, {
				workspace_path: workspace2,
			})
		})

		it("should handle empty workspace path", async () => {
			const serviceWithEmptyWorkspace = new EpisodeSearchService(
				mockEmbedder,
				mockVectorStore,
				mockTemporalScorer,
				"",
			)

			await serviceWithEmptyWorkspace.searchByEpisode("test query")

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Array),
				expect.any(Number),
				{ workspace_path: "" },
			)
		})

		it("should maintain consistent search parameters across calls", async () => {
			await service.searchByEpisode("query1", 10)
			await service.searchByEpisode("query2", 3)

			// Both should request 50 results for grouping regardless of final limit
			expect(mockVectorStore.search).toHaveBeenNthCalledWith(
				1,
				"query1",
				expect.any(Array),
				50,
				expect.any(Object),
			)
			expect(mockVectorStore.search).toHaveBeenNthCalledWith(
				2,
				"query2",
				expect.any(Array),
				50,
				expect.any(Object),
			)
		})

		it("should handle special characters in workspace path", async () => {
			const specialWorkspace = "/workspace with spaces/and-dashes/under_scores"
			const serviceWithSpecialWorkspace = new EpisodeSearchService(
				mockEmbedder,
				mockVectorStore,
				mockTemporalScorer,
				specialWorkspace,
			)

			await serviceWithSpecialWorkspace.searchByEpisode("test query")

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				expect.any(String),
				expect.any(Array),
				expect.any(Number),
				{ workspace_path: specialWorkspace },
			)
		})
	})

	describe("Error Handling Tests", () => {
		it("should handle embedder network failures gracefully", async () => {
			const networkError = new Error("Network timeout")
			mockEmbedder.embed = vi.fn().mockRejectedValue(networkError)

			await expect(service.searchByEpisode("test query")).rejects.toThrow("Network timeout")
		})

		it("should handle vector store timeout errors", async () => {
			const timeoutError = new Error("Search request timed out")
			mockVectorStore.search = vi.fn().mockRejectedValue(timeoutError)

			await expect(service.searchByEpisode("test query")).rejects.toThrow("Search request timed out")
		})

		it("should handle malformed vector store responses", async () => {
			const malformedResults = [
				{
					id: "fact-1",
					vector: [0.1, 0.2],
					payload: null, // Malformed payload
					score: 0.9,
				},
			]
			mockVectorStore.search = vi.fn().mockResolvedValue(malformedResults)

			await expect(service.searchByEpisode("test query")).rejects.toThrow()
		})

		it("should handle empty query strings", async () => {
			const results = await service.searchByEpisode("")

			expect(mockEmbedder.embed).toHaveBeenCalledWith("")
			expect(results).toBeDefined()
		})

		it("should handle very long query strings", async () => {
			const longQuery = "a".repeat(10000)
			mockVectorStore.search = vi.fn().mockResolvedValue([])

			const results = await service.searchByEpisode(longQuery)

			expect(mockEmbedder.embed).toHaveBeenCalledWith(longQuery)
			expect(results).toEqual([])
		})

		it("should handle invalid limit parameters gracefully", async () => {
			const facts = [createTestFact()]
			const vectorResults = [createVectorRecord(facts[0])]
			mockVectorStore.search = vi.fn().mockResolvedValue(vectorResults)

			// Test negative limit
			const negativeResults = await service.searchByEpisode("test query", -1)
			expect(negativeResults).toHaveLength(0)

			// Test zero limit
			const zeroResults = await service.searchByEpisode("test query", 0)
			expect(zeroResults).toHaveLength(0)
		})
	})
})
