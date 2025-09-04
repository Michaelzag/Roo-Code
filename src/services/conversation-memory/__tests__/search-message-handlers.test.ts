/**
 * Integration tests for conversation memory search message handlers
 *
 * Tests the backend message handlers that integrate the conversation memory search UI
 * with the existing conversation-memory system backend.
 */

import { ConversationMemoryManager } from "../manager"
import { ConversationMemoryOrchestrator } from "../orchestrator"
import { webviewMessageHandler } from "../../../core/webview/webviewMessageHandler"
import { ClineProvider } from "../../../core/webview/ClineProvider"

// Test setup utilities
const createMockProvider = () => {
	const mockPostMessageToWebview = vi.fn()
	const mockLog = vi.fn()
	const mockGetCurrentWorkspaceConversationMemoryManager = vi.fn()

	return {
		postMessageToWebview: mockPostMessageToWebview,
		log: mockLog,
		getCurrentWorkspaceConversationMemoryManager: mockGetCurrentWorkspaceConversationMemoryManager,
		_mocks: {
			postMessageToWebview: mockPostMessageToWebview,
			log: mockLog,
			getCurrentWorkspaceConversationMemoryManager: mockGetCurrentWorkspaceConversationMemoryManager,
		},
	} as any
}

const createMockMemoryManager = (isInitialized = true) => {
	const mockSearchMemoriesWithFilters = vi.fn()
	const mockSearchEpisodes = vi.fn()
	const mockSearch = vi.fn()

	return {
		isInitialized,
		searchMemoriesWithFilters: mockSearchMemoriesWithFilters,
		searchEpisodes: mockSearchEpisodes,
		search: mockSearch,
		_mocks: {
			searchMemoriesWithFilters: mockSearchMemoriesWithFilters,
			searchEpisodes: mockSearchEpisodes,
			search: mockSearch,
		},
	} as any
}

const sampleSearchResults = [
	{
		id: "result1",
		title: "Test Memory 1",
		content: "This is a test memory about coding",
		timestamp: new Date("2024-01-01"),
		episodeType: "conversation",
		relevanceScore: 0.9,
		episodeId: "episode1",
		metadata: { source: "test" },
	},
	{
		id: "result2",
		title: "Test Memory 2",
		content: "This is another test memory",
		timestamp: new Date("2024-01-02"),
		episodeType: "fact",
		relevanceScore: 0.8,
		episodeId: "episode2",
		metadata: { source: "test" },
	},
]

describe("Conversation Memory Search Message Handlers", () => {
	let provider: any
	let memoryManager: any

	beforeEach(() => {
		provider = createMockProvider()
		memoryManager = createMockMemoryManager()
		provider._mocks.getCurrentWorkspaceConversationMemoryManager.mockReturnValue(memoryManager)
		vi.clearAllMocks()
	})

	describe("conversationMemorySearch message handler", () => {
		it("should successfully perform search with basic query", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockResolvedValue(sampleSearchResults)

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(memoryManager._mocks.searchMemoriesWithFilters).toHaveBeenCalledWith({
				query: "test query",
				timeRange: undefined,
				episodeType: undefined,
				relevanceThreshold: undefined,
				limit: 10,
			})

			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: true,
					results: expect.arrayContaining([
						expect.objectContaining({
							id: "result1",
							title: "Test Memory 1",
							content: "This is a test memory about coding",
							episodeType: "conversation",
							relevanceScore: 0.9,
						}),
						expect.objectContaining({
							id: "result2",
							title: "Test Memory 2",
							content: "This is another test memory",
							episodeType: "fact",
							relevanceScore: 0.8,
						}),
					]),
					query: "test query",
					totalResults: 2,
				},
			})
		})

		it("should apply time range filters correctly", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockResolvedValue(sampleSearchResults)

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				memoryFilters: {
					timeRange: "week" as const,
					episodeType: "all" as const,
					relevanceThreshold: 0.5,
				},
				limit: 5,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify time range calculation
			const callArgs = memoryManager._mocks.searchMemoriesWithFilters.mock.calls[0][0]
			expect(callArgs.query).toBe("test query")
			expect(callArgs.timeRange).toEqual({
				start: expect.any(Date),
			})
			expect(callArgs.episodeType).toBe("all")
			expect(callArgs.relevanceThreshold).toBe(0.5)
			expect(callArgs.limit).toBe(5)

			// Verify time range is approximately 7 days ago
			const weekAgo = new Date()
			weekAgo.setDate(weekAgo.getDate() - 7)
			const actualStart = callArgs.timeRange.start
			const timeDiff = Math.abs(actualStart.getTime() - weekAgo.getTime())
			expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000) // Within 24 hours
		})

		it("should apply month time range filter", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockResolvedValue([])

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test",
				memoryFilters: { timeRange: "month" as const },
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			const callArgs = memoryManager._mocks.searchMemoriesWithFilters.mock.calls[0][0]
			expect(callArgs.timeRange).toEqual({
				start: expect.any(Date),
			})

			// Verify time range is approximately 30 days ago
			const monthAgo = new Date()
			monthAgo.setDate(monthAgo.getDate() - 30)
			const actualStart = callArgs.timeRange.start
			const timeDiff = Math.abs(actualStart.getTime() - monthAgo.getTime())
			expect(timeDiff).toBeLessThan(24 * 60 * 60 * 1000) // Within 24 hours
		})

		it("should apply today time range filter", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockResolvedValue([])

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test",
				memoryFilters: { timeRange: "today" as const },
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			const callArgs = memoryManager._mocks.searchMemoriesWithFilters.mock.calls[0][0]
			expect(callArgs.timeRange).toEqual({
				start: expect.any(Date),
			})

			// Verify time range is start of today
			const today = new Date()
			today.setHours(0, 0, 0, 0)
			const actualStart = callArgs.timeRange.start
			expect(actualStart.getTime()).toBe(today.getTime())
		})

		it("should handle no memory manager available", async () => {
			// Setup
			provider._mocks.getCurrentWorkspaceConversationMemoryManager.mockReturnValue(null)

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Conversation memory not available",
				},
			})
		})

		it("should handle uninitialized memory manager", async () => {
			// Setup
			memoryManager.isInitialized = false

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Conversation memory not initialized",
				},
			})
		})

		it("should handle empty query", async () => {
			const message = {
				type: "conversationMemorySearch" as const,
				query: "",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Search query is required",
				},
			})
		})

		it("should handle whitespace-only query", async () => {
			const message = {
				type: "conversationMemorySearch" as const,
				query: "   \t\n   ",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Search query is required",
				},
			})
		})

		it("should handle search errors with specific error messages", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockRejectedValue(new Error("embedder not configured"))

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Search failed - check embedder configuration",
				},
			})
			expect(provider._mocks.log).toHaveBeenCalledWith(
				"[conversationMemorySearch] Search failed: embedder not configured",
			)
		})

		it("should handle vector store errors", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockRejectedValue(new Error("qdrant connection failed"))

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Search failed - vector store unavailable",
				},
			})
		})

		it("should handle timeout errors", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockRejectedValue(new Error("Search timeout after 30s"))

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Search timed out - try a simpler query",
				},
			})
		})

		it("should handle unexpected errors gracefully", async () => {
			// Setup - simulate an unexpected error in the handler itself
			provider._mocks.getCurrentWorkspaceConversationMemoryManager.mockImplementation(() => {
				throw new Error("Unexpected system error")
			})

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: 10,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify
			expect(provider._mocks.postMessageToWebview).toHaveBeenCalledWith({
				type: "conversationMemorySearchResults",
				values: {
					success: false,
					error: "Search failed due to unexpected error",
				},
			})
			expect(provider._mocks.log).toHaveBeenCalledWith(
				"[conversationMemorySearch] Handler error: Unexpected system error",
			)
		})

		it("should use default limit when not provided", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockResolvedValue([])

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				// No limit provided
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify default limit is used
			const callArgs = memoryManager._mocks.searchMemoriesWithFilters.mock.calls[0][0]
			expect(callArgs.limit).toBe(10)
		})

		it("should handle negative limit gracefully", async () => {
			// Setup
			memoryManager._mocks.searchMemoriesWithFilters.mockResolvedValue([])

			const message = {
				type: "conversationMemorySearch" as const,
				query: "test query",
				filters: {},
				limit: -5,
			}

			// Execute
			await webviewMessageHandler(provider, message)

			// Verify default limit is used
			const callArgs = memoryManager._mocks.searchMemoriesWithFilters.mock.calls[0][0]
			expect(callArgs.limit).toBe(10)
		})
	})

	describe("ConversationMemoryManager.searchMemoriesWithFilters", () => {
		let manager: ConversationMemoryManager
		let mockOrchestrator: any

		beforeEach(() => {
			mockOrchestrator = {
				searchEpisodes: vi.fn(),
				search: vi.fn(),
			}

			// Create a real manager instance but mock the orchestrator
			manager = new (ConversationMemoryManager as any)("/test/workspace", {} as any)
			;(manager as any).orchestrator = mockOrchestrator
		})

		it("should search episodes first and return formatted results", async () => {
			// Setup
			const episodeResults = [
				{
					id: "ep1",
					title: "Episode 1",
					content: "Episode content",
					timestamp: new Date("2024-01-01"),
					episodeType: "conversation",
					relevanceScore: 0.9,
				},
			]
			mockOrchestrator.searchEpisodes.mockResolvedValue(episodeResults)

			// Execute
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				limit: 5,
			})

			// Verify
			expect(mockOrchestrator.searchEpisodes).toHaveBeenCalledWith("test query", 20) // Math.max(limit * 2, 20)
			expect(mockOrchestrator.search).not.toHaveBeenCalled()
			expect(results).toHaveLength(1)
			expect(results[0]).toEqual(
				expect.objectContaining({
					id: "ep1",
					title: "Episode 1",
					content: "Episode content",
					episodeType: "conversation",
					relevanceScore: 0.9,
				}),
			)
		})

		it("should fall back to fact search when no episodes found", async () => {
			// Setup
			mockOrchestrator.searchEpisodes.mockResolvedValue([])
			const factResults = [
				{
					id: "fact1",
					content: "Fact content",
					score: 0.8,
					timestamp: new Date("2024-01-01"),
				},
			]
			mockOrchestrator.search.mockResolvedValue(factResults)

			// Execute
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				limit: 5,
			})

			// Verify
			expect(mockOrchestrator.searchEpisodes).toHaveBeenCalledWith("test query", 20)
			expect(mockOrchestrator.search).toHaveBeenCalledWith("test query")
			expect(results).toHaveLength(1)
			expect(results[0]).toEqual(
				expect.objectContaining({
					id: "fact1",
					title: "Fact content", // Should use content as title for facts
					content: "Fact content",
					episodeType: "fact",
					relevanceScore: 0.8,
				}),
			)
		})

		it("should filter results by time range", async () => {
			// Setup
			const now = new Date("2024-01-15T12:00:00Z")
			const oldResult = {
				id: "old",
				title: "Old result",
				content: "Old content",
				timestamp: new Date("2024-01-01T12:00:00Z"), // 14 days ago
				episodeType: "conversation",
				relevanceScore: 0.9,
			}
			const recentResult = {
				id: "recent",
				title: "Recent result",
				content: "Recent content",
				timestamp: new Date("2024-01-14T12:00:00Z"), // 1 day ago
				episodeType: "conversation",
				relevanceScore: 0.8,
			}
			mockOrchestrator.searchEpisodes.mockResolvedValue([oldResult, recentResult])

			// Execute with week filter (7 days)
			const weekAgo = new Date("2024-01-08T12:00:00Z")
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				timeRange: { start: weekAgo },
				limit: 10,
			})

			// Verify only recent result is returned
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("recent")
		})

		it("should filter results by episode type", async () => {
			// Setup
			const conversationResult = {
				id: "conv1",
				title: "Conversation",
				content: "Conversation content",
				timestamp: new Date(),
				episodeType: "conversation",
				relevanceScore: 0.9,
			}
			const factResult = {
				id: "fact1",
				title: "Fact",
				content: "Fact content",
				timestamp: new Date(),
				episodeType: "fact",
				relevanceScore: 0.8,
			}
			mockOrchestrator.searchEpisodes.mockResolvedValue([conversationResult, factResult])

			// Execute with conversation filter
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				episodeType: "conversation",
				limit: 10,
			})

			// Verify only conversation result is returned
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("conv1")
		})

		it("should filter results by relevance threshold", async () => {
			// Setup
			const highRelevanceResult = {
				id: "high",
				title: "High relevance",
				content: "High content",
				timestamp: new Date(),
				episodeType: "conversation",
				relevanceScore: 0.9,
			}
			const lowRelevanceResult = {
				id: "low",
				title: "Low relevance",
				content: "Low content",
				timestamp: new Date(),
				episodeType: "conversation",
				relevanceScore: 0.3,
			}
			mockOrchestrator.searchEpisodes.mockResolvedValue([highRelevanceResult, lowRelevanceResult])

			// Execute with threshold of 0.5
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				relevanceThreshold: 0.5,
				limit: 10,
			})

			// Verify only high relevance result is returned
			expect(results).toHaveLength(1)
			expect(results[0].id).toBe("high")
		})

		it("should apply limit correctly", async () => {
			// Setup
			const manyResults = Array.from({ length: 10 }, (_, i) => ({
				id: `result${i}`,
				title: `Result ${i}`,
				content: `Content ${i}`,
				timestamp: new Date(),
				episodeType: "conversation",
				relevanceScore: 0.9,
			}))
			mockOrchestrator.searchEpisodes.mockResolvedValue(manyResults)

			// Execute with limit of 3
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				limit: 3,
			})

			// Verify only 3 results are returned
			expect(results).toHaveLength(3)
			expect(results.map((r) => r.id)).toEqual(["result0", "result1", "result2"])
		})

		it("should handle orchestrator errors and re-throw with context", async () => {
			// Setup
			mockOrchestrator.searchEpisodes.mockRejectedValue(new Error("Vector store error"))

			// Execute & Verify
			await expect(
				manager.searchMemoriesWithFilters({
					query: "test query",
					limit: 5,
				}),
			).rejects.toThrow("Memory search failed: Vector store error")
		})

		it("should return empty array when orchestrator is not available", async () => {
			// Setup
			;(manager as any).orchestrator = null

			// Execute
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				limit: 5,
			})

			// Verify
			expect(results).toEqual([])
		})

		it("should handle results with missing fields gracefully", async () => {
			// Setup
			const incompleteResult = {
				// Missing title, episodeType, relevanceScore
				id: "incomplete",
				content: "Some content",
			}
			mockOrchestrator.searchEpisodes.mockResolvedValue([incompleteResult])

			// Execute
			const results = await manager.searchMemoriesWithFilters({
				query: "test query",
				limit: 5,
			})

			// Verify defaults are applied
			expect(results).toHaveLength(1)
			expect(results[0]).toEqual(
				expect.objectContaining({
					id: "incomplete",
					title: "Some content", // Should use content substring as title
					content: "Some content",
					episodeType: "fact", // Default
					relevanceScore: 0, // Default
					timestamp: expect.any(Date),
					episodeId: "incomplete", // Should use id as episodeId
					metadata: {},
				}),
			)
		})
	})
})
