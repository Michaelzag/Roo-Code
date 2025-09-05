import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConversationMemoryOrchestrator } from "../orchestrator"
import { ConversationMemoryStateManager } from "../state-manager"
import type { IEmbedder, IVectorStore } from "../interfaces"

// Mock fs/promises directly
const mockRm = vi.fn().mockResolvedValue(undefined)
vi.mock("fs/promises", () => ({
	rm: mockRm,
}))

// Mock path directly
const mockJoin = vi.fn((...args) => args.join("/"))
vi.mock("path", () => ({
	join: mockJoin,
}))

// Mock Node.js require to intercept dynamic requires
const originalRequire = globalThis.require
vi.stubGlobal(
	"require",
	vi.fn((id: string) => {
		if (id === "fs/promises") {
			return { rm: mockRm }
		}
		if (id === "path") {
			return { join: mockJoin }
		}
		return originalRequire?.(id)
	}),
)

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
		// Verify the mocked rm function was called correctly
		expect(mockRm).toHaveBeenCalledWith("/test/workspace/.roo-memory", { recursive: true, force: true })
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
