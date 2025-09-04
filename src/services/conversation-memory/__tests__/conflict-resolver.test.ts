import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConflictResolver } from "../processors/conflict-resolver"
import type { IVectorStore } from "../interfaces"
import type { CategorizedFactInput } from "../types"

/**
 * Tests for the ConflictResolver which implements the core conflict detection
 * and resolution logic for conversation memory facts.
 *
 * Tests cover the key memory actions from zagmems specification:
 * - ADD: New information not conflicting with existing facts
 * - IGNORE: Near-duplicate facts that should be ignored
 * - SUPERSEDE: Architecture decisions that replace previous ones
 * - DELETE_EXISTING: Debugging facts marked as resolved
 */
describe("ConflictResolver", () => {
	let resolver: ConflictResolver
	let mockVectorStore: IVectorStore
	const testWorkspacePath = "/test/workspace"

	beforeEach(() => {
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

		resolver = new ConflictResolver(mockVectorStore, testWorkspacePath)
	})

	const createMockFact = (overrides: Partial<CategorizedFactInput> = {}): CategorizedFactInput => ({
		content: "Test fact content",
		category: "infrastructure",
		confidence: 0.8,
		embedding: [0.1, 0.2, 0.3],
		reference_time: new Date(),
		context_description: "Test context",
		...overrides,
	})

	describe("ADD action", () => {
		it("should return ADD when no embedding is provided", async () => {
			const fact = createMockFact({
				embedding: undefined,
			})

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
			expect(actions[0].fact).toBe(fact)
			expect(mockVectorStore.search).not.toHaveBeenCalled()
		})

		it("should return ADD when empty embedding is provided", async () => {
			const fact = createMockFact({
				embedding: [],
			})

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
			expect(actions[0].fact).toBe(fact)
			expect(mockVectorStore.search).not.toHaveBeenCalled()
		})

		it("should return ADD when no similar facts are found", async () => {
			const fact = createMockFact()
			vi.mocked(mockVectorStore.search).mockResolvedValue([])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
			expect(actions[0].fact).toBe(fact)
		})

		it("should return ADD for infrastructure facts with low similarity", async () => {
			const fact = createMockFact({
				category: "infrastructure",
				content: "Using PostgreSQL database",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "existing-fact",
					score: 0.6, // Below threshold
					vector: [0.2, 0.3, 0.4],
					payload: {
						content: "Using MySQL database",
						category: "infrastructure",
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
		})

		it("should return ADD for pattern facts regardless of similarity", async () => {
			const fact = createMockFact({
				category: "pattern",
				content: "Use lazy loading for performance",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "similar-pattern",
					score: 0.85, // High similarity
					vector: [0.2, 0.3, 0.4],
					payload: {
						content: "Use eager loading for performance",
						category: "pattern",
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
		})
	})

	describe("IGNORE action", () => {
		it("should return IGNORE for near-duplicate facts with high similarity", async () => {
			const fact = createMockFact({
				content: "using react with typescript",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "existing-duplicate",
					score: 0.97, // Very high similarity
					vector: [0.1, 0.2, 0.3],
					payload: {
						content: "using react with typescript", // Same content (case insensitive)
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("IGNORE")
			expect(actions[0].fact).toBe(fact)
			expect(actions[0].target_ids).toEqual(["existing-duplicate"])
		})

		it("should return IGNORE for exact duplicates with different casing", async () => {
			const fact = createMockFact({
				content: "Using React with TypeScript",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "existing-duplicate",
					score: 0.98,
					vector: [0.1, 0.2, 0.3],
					payload: {
						content: "USING REACT WITH TYPESCRIPT", // Different case
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("IGNORE")
			expect(actions[0].target_ids).toEqual(["existing-duplicate"])
		})

		it("should not ignore similar facts with different content", async () => {
			const fact = createMockFact({
				content: "Using React with TypeScript",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "similar-but-different",
					score: 0.97, // High similarity
					vector: [0.1, 0.2, 0.3],
					payload: {
						content: "Using Vue with TypeScript", // Different content
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD") // Should not ignore
		})

		it("should not ignore facts with high similarity but low score threshold", async () => {
			const fact = createMockFact({
				content: "Using React with TypeScript",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "lower-similarity",
					score: 0.94, // Below 0.95 threshold
					vector: [0.1, 0.2, 0.3],
					payload: {
						content: "using react with typescript",
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
		})
	})

	describe("SUPERSEDE action", () => {
		it("should return SUPERSEDE for architecture facts with similar but different content", async () => {
			const fact = createMockFact({
				category: "architecture",
				content: "Using session-based authentication",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "old-auth-decision",
					score: 0.85, // Above 0.8 threshold
					vector: [0.2, 0.3, 0.4],
					payload: {
						content: "Using JWT token authentication", // Different content
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("SUPERSEDE")
			expect(actions[0].fact).toBe(fact)
			expect(actions[0].target_ids).toEqual(["old-auth-decision"])
		})

		it("should return SUPERSEDE for multiple conflicting architecture facts", async () => {
			const fact = createMockFact({
				category: "architecture",
				content: "Using microservices architecture",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "old-arch-1",
					score: 0.82,
					vector: [0.2, 0.3, 0.4],
					payload: {
						content: "Using monolithic architecture",
					},
				},
				{
					id: "old-arch-2",
					score: 0.85,
					vector: [0.3, 0.4, 0.5],
					payload: {
						content: "Using layered architecture",
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("SUPERSEDE")
			expect(actions[0].target_ids).toEqual(["old-arch-1", "old-arch-2"])
		})

		it("should not supersede architecture facts with low similarity", async () => {
			const fact = createMockFact({
				category: "architecture",
				content: "Using session-based authentication",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "unrelated-arch",
					score: 0.75, // Below 0.8 threshold
					vector: [0.2, 0.3, 0.4],
					payload: {
						content: "Using microservices architecture",
					},
				},
			])

			const actions = await resolver.resolve(fact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
		})

		it("should not supersede architecture facts with same content", async () => {
			const fact = createMockFact({
				category: "architecture",
				content: "Using JWT authentication",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "same-arch",
					score: 0.96, // Need > 0.95 for IGNORE trigger
					vector: [0.1, 0.2, 0.3],
					payload: {
						content: "using jwt authentication", // Same content (case insensitive)
					},
				},
			])

			const actions = await resolver.resolve(fact)

			// Should IGNORE due to high similarity (>0.95) AND same content
			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("IGNORE")
		})

		it("should only supersede for architecture category", async () => {
			const infrastructureFact = createMockFact({
				category: "infrastructure",
				content: "Using PostgreSQL database",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "similar-infra",
					score: 0.85, // Above threshold
					vector: [0.2, 0.3, 0.4],
					payload: {
						content: "Using MySQL database",
					},
				},
			])

			const actions = await resolver.resolve(infrastructureFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD") // Not SUPERSEDE
		})
	})

	describe("DELETE_EXISTING action", () => {
		it("should return DELETE_EXISTING for resolved debugging facts", async () => {
			const resolvedFact = createMockFact({
				category: "debugging",
				content: "Memory leak issue has been fixed by updating cleanup logic",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "original-bug",
					score: 0.88, // Above 0.85 threshold
					vector: [0.2, 0.3, 0.4],
					payload: {
						content: "Memory leak detected in component cleanup",
						category: "debugging",
					},
				},
			])

			const actions = await resolver.resolve(resolvedFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("DELETE_EXISTING")
			expect(actions[0].fact).toBe(resolvedFact)
			expect(actions[0].target_ids).toEqual(["original-bug"])
		})

		it("should handle multiple resolved keywords", async () => {
			const testCases = [
				"Bug has been resolved",
				"Issue is now fixed",
				"Problem resolved successfully",
				"Error no longer occurs",
				"Fixed the authentication bug",
			]

			for (const content of testCases) {
				const fact = createMockFact({
					category: "debugging",
					content,
				})

				vi.mocked(mockVectorStore.search).mockResolvedValue([
					{
						id: "related-bug",
						score: 0.9,
						vector: [0.2, 0.3, 0.4],
						payload: { content: "Original bug report" },
					},
				])

				const actions = await resolver.resolve(fact)

				expect(actions[0].type).toBe("DELETE_EXISTING")
				expect(actions[0].target_ids).toEqual(["related-bug"])
			}
		})

		it("should return DELETE_EXISTING for multiple related debugging facts", async () => {
			const resolvedFact = createMockFact({
				category: "debugging",
				content: "CORS issue has been resolved by updating server config",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "cors-bug-1",
					score: 0.9,
					vector: [0.2, 0.3, 0.4],
					payload: { content: "CORS error in production" },
				},
				{
					id: "cors-bug-2",
					score: 0.87,
					vector: [0.3, 0.4, 0.5],
					payload: { content: "CORS blocking API calls" },
				},
			])

			const actions = await resolver.resolve(resolvedFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("DELETE_EXISTING")
			expect(actions[0].target_ids).toEqual(["cors-bug-1", "cors-bug-2"])
		})

		it("should not delete debugging facts with low similarity", async () => {
			const resolvedFact = createMockFact({
				category: "debugging",
				content: "Authentication bug fixed",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "unrelated-bug",
					score: 0.6, // Below 0.85 threshold
					vector: [0.2, 0.3, 0.4],
					payload: { content: "Database performance issue" },
				},
			])

			const actions = await resolver.resolve(resolvedFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
		})

		it("should not delete for debugging facts without resolution keywords", async () => {
			const unresolvedFact = createMockFact({
				category: "debugging",
				content: "Still experiencing memory leak in component",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "similar-bug",
					score: 0.9, // High similarity
					vector: [0.2, 0.3, 0.4],
					payload: { content: "Memory leak in component detected" },
				},
			])

			const actions = await resolver.resolve(unresolvedFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD") // Not DELETE_EXISTING
		})

		it("should only delete for debugging category facts", async () => {
			const patternFact = createMockFact({
				category: "pattern",
				content: "Fixed memory leak by implementing proper cleanup",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "similar-pattern",
					score: 0.9,
					vector: [0.2, 0.3, 0.4],
					payload: { content: "Memory management pattern" },
				},
			])

			const actions = await resolver.resolve(patternFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD") // Not DELETE_EXISTING
		})
	})

	describe("workspace isolation", () => {
		it("should filter search results by workspace path", async () => {
			const fact = createMockFact({
				category: "architecture",
				content: "Using session authentication",
			})

			await resolver.resolve(fact)

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				fact.content,
				fact.embedding,
				8,
				expect.objectContaining({
					workspace_path: testWorkspacePath,
				}),
			)
		})

		it("should include category filter in search", async () => {
			const fact = createMockFact({
				category: "infrastructure",
				content: "Using PostgreSQL database",
			})

			await resolver.resolve(fact)

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				fact.content,
				fact.embedding,
				8,
				expect.objectContaining({
					workspace_path: testWorkspacePath,
					category: "infrastructure",
				}),
			)
		})

		it("should handle facts without category", async () => {
			const fact = createMockFact({
				category: undefined as any,
			})

			await resolver.resolve(fact)

			expect(mockVectorStore.search).toHaveBeenCalledWith(
				fact.content,
				fact.embedding,
				8,
				expect.objectContaining({
					workspace_path: testWorkspacePath,
				}),
			)

			// Should not include category filter
			const searchCall = vi.mocked(mockVectorStore.search).mock.calls[0]
			expect(searchCall[3]).not.toHaveProperty("category")
		})
	})

	describe("error handling", () => {
		it("should handle vector store search failures gracefully", async () => {
			const fact = createMockFact()
			vi.mocked(mockVectorStore.search).mockRejectedValue(new Error("Vector store error"))

			await expect(resolver.resolve(fact)).rejects.toThrow("Vector store error")
		})

		it("should handle missing payload in search results", async () => {
			const fact = createMockFact({
				category: "architecture",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "malformed-result",
					score: 0.9,
					vector: [0.2, 0.3, 0.4],
					payload: null, // Missing payload
				},
			])

			const actions = await resolver.resolve(fact)

			// Missing payload means empty string content, which differs from fact content
			// Architecture fact with >0.8 score and different content triggers SUPERSEDE
			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("SUPERSEDE")
		})

		it("should handle search results without scores", async () => {
			const fact = createMockFact()

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "no-score-result",
					score: undefined, // No score
					vector: [0.2, 0.3, 0.4],
					payload: { content: "Some content" },
				},
			])

			const actions = await resolver.resolve(fact)

			// Should treat as score = 0 and add normally
			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("ADD")
		})
	})

	describe("integration scenarios", () => {
		it("should handle complex architecture evolution scenario", async () => {
			// Scenario: JWT -> Sessions -> OAuth evolution
			const oauthFact = createMockFact({
				category: "architecture",
				content: "Switched to OAuth 2.0 authentication with Google provider",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "old-jwt",
					score: 0.75, // Related but different
					vector: [0.1, 0.2, 0.3],
					payload: { content: "Using JWT tokens for auth" },
				},
				{
					id: "old-sessions",
					score: 0.82, // Closer match
					vector: [0.2, 0.3, 0.4],
					payload: { content: "Using session-based authentication" },
				},
			])

			const actions = await resolver.resolve(oauthFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("SUPERSEDE")
			expect(actions[0].target_ids).toEqual(["old-sessions"]) // Only high similarity
		})

		it("should handle bug resolution with pattern creation scenario", async () => {
			const bugFixFact = createMockFact({
				category: "debugging",
				content: "Memory leak fixed by implementing componentWillUnmount cleanup",
			})

			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "original-memory-bug",
					score: 0.92,
					vector: [0.3, 0.4, 0.5],
					payload: { content: "Memory leak detected in React components" },
				},
			])

			const actions = await resolver.resolve(bugFixFact)

			expect(actions).toHaveLength(1)
			expect(actions[0].type).toBe("DELETE_EXISTING")
			expect(actions[0].target_ids).toEqual(["original-memory-bug"])
			// This would typically be followed by pattern promotion in the orchestrator
		})
	})
})
