import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock vscode module
vi.mock("vscode", () => ({
	EventEmitter: vi.fn().mockImplementation(() => ({
		fire: vi.fn(),
		event: vi.fn(),
		dispose: vi.fn(),
	})),
}))

import { ConversationMemoryOrchestrator } from "../orchestrator"
import { ConversationMemoryStateManager } from "../state-manager"
import type { IEmbedder, ILlmProvider, IVectorStore } from "../interfaces"

describe("ConversationMemoryOrchestrator", () => {
	let orchestrator: ConversationMemoryOrchestrator
	let stateManager: ConversationMemoryStateManager
	let mockVectorStore: IVectorStore
	let mockEmbedder: IEmbedder
	let mockLlm: ILlmProvider

	beforeEach(() => {
		stateManager = new ConversationMemoryStateManager()

		mockVectorStore = {
			ensureCollection: vi.fn().mockResolvedValue(undefined),
			collectionName: vi.fn().mockReturnValue("test-collection"),
			upsert: vi.fn().mockResolvedValue(undefined),
			insert: vi.fn().mockResolvedValue(undefined),
			update: vi.fn().mockResolvedValue(undefined),
			delete: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(undefined),
			search: vi.fn().mockResolvedValue([]),
			filter: vi.fn().mockResolvedValue([]),
		}

		mockEmbedder = {
			embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
			embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
			dimension: 3,
		}

		mockLlm = {
			generateJson: vi.fn().mockResolvedValue({ facts: [] }),
		}

		orchestrator = new ConversationMemoryOrchestrator(
			"/test/workspace",
			mockVectorStore,
			mockEmbedder,
			stateManager,
			mockLlm,
		)
	})

	describe("start", () => {
		it("should ensure collection exists and set state to Indexed", async () => {
			await orchestrator.start()

			expect(mockVectorStore.ensureCollection).toHaveBeenCalledWith(
				expect.stringMatching(/^ws-[a-f0-9]{16}-memory$/),
				3,
			)
			expect(stateManager.state).toBe("Indexed")
			expect(stateManager.getCurrentStatus().systemMessage).toBe("Conversation memory ready")
		})

		it("should handle errors during start", async () => {
			const error = new Error("Vector store error")
			vi.mocked(mockVectorStore.ensureCollection).mockRejectedValue(error)

			await expect(orchestrator.start()).rejects.toThrow("Vector store error")
		})
	})

	describe("stop", () => {
		it("should set state to Standby when not in error state", () => {
			stateManager.setSystemState("Indexed", "Test message")
			orchestrator.stop()

			expect(stateManager.state).toBe("Standby")
		})

		it("should not change state when in error state", () => {
			stateManager.setSystemState("Error", "Error message")
			orchestrator.stop()

			expect(stateManager.state).toBe("Error")
		})
	})

	describe("search", () => {
		it("should delegate to search service", async () => {
			const mockResults = [
				{
					id: "fact-1",
					content: "Test fact",
					category: "pattern" as const,
					confidence: 0.9,
					reference_time: Date.now(),
					context_description: "Test context",
				},
			]
			vi.mocked(mockVectorStore.search).mockResolvedValue([
				{
					id: "fact-1",
					score: 0.9,
					vector: [0.1, 0.2, 0.3],
					payload: mockResults[0],
				},
			])

			const results = await orchestrator.search("test query")

			expect(mockEmbedder.embed).toHaveBeenCalledWith("test query")
			expect(mockVectorStore.search).toHaveBeenCalled()
		})
	})
})
