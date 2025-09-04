import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConversationMemoryOrchestrator } from "../orchestrator"
import { ConversationMemoryStateManager } from "../state-manager"
import type { IEmbedder, IVectorStore } from "../interfaces"
import * as fs from "fs/promises"

vi.mock("fs/promises", () => ({
	rm: vi.fn().mockResolvedValue(undefined),
}))

describe("ConversationMemoryOrchestrator.clearMemoryData", () => {
	let stateManager: ConversationMemoryStateManager
	let mockVectorStore: IVectorStore
	let mockEmbedder: IEmbedder
	const workspacePath = "/test/workspace"

	beforeEach(() => {
		vi.clearAllMocks()
		stateManager = new ConversationMemoryStateManager()
		mockEmbedder = { embed: vi.fn(), embedBatch: vi.fn(), dimension: 3 }
	})

	it("prefers deleteCollection and removes artifacts dir", async () => {
		mockVectorStore = {
			ensureCollection: vi.fn(),
			collectionName: vi.fn().mockReturnValue("test-collection"),
			upsert: vi.fn(),
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			get: vi.fn(),
			search: vi.fn(),
			filter: vi.fn(),
			deleteCollection: vi.fn().mockResolvedValue(undefined),
		}

		const orch = new ConversationMemoryOrchestrator(workspacePath, mockVectorStore, mockEmbedder, stateManager)

		await orch.clearMemoryData()

		expect((mockVectorStore as any).deleteCollection).toHaveBeenCalledTimes(1)
		expect(fs.rm).toHaveBeenCalledWith("/test/workspace/.roo-memory", { recursive: true, force: true })
		expect(stateManager.state).toBe("Standby")
		expect(stateManager.getCurrentStatus().systemMessage).toMatch(/cleared successfully/i)
	})

	it("falls back to clearCollection when deleteCollection not available", async () => {
		mockVectorStore = {
			ensureCollection: vi.fn(),
			collectionName: vi.fn().mockReturnValue("test-collection"),
			upsert: vi.fn(),
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
			get: vi.fn(),
			search: vi.fn(),
			filter: vi.fn(),
			clearCollection: vi.fn().mockResolvedValue(undefined),
		}

		const orch = new ConversationMemoryOrchestrator(workspacePath, mockVectorStore, mockEmbedder, stateManager)

		await orch.clearMemoryData()

		expect((mockVectorStore as any).clearCollection).toHaveBeenCalledTimes(1)
		expect(stateManager.state).toBe("Standby")
	})
})

describe("ConversationMemoryManager.clearMemoryData", () => {
	it("delegates to orchestrator", async () => {
		const { ConversationMemoryManager } = await import("../manager")
		// Create a dummy manager instance by bypassing getInstance complexity
		const mgr: any = Object.create(ConversationMemoryManager.prototype)
		mgr.orchestrator = { clearMemoryData: vi.fn().mockResolvedValue(undefined) }

		await ConversationMemoryManager.prototype.clearMemoryData.call(mgr)

		expect(mgr.orchestrator.clearMemoryData).toHaveBeenCalledTimes(1)
	})
})
