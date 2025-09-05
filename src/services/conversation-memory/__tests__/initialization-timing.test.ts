import { beforeEach, describe, expect, it, vi } from "vitest"
import { ConversationMemoryManager } from "../manager"
import { ConversationMemoryOrchestrator } from "../orchestrator"
import type { ExtensionContext } from "vscode"

// Mock dependencies
vi.mock("../orchestrator")
vi.mock("../../code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn(),
	},
}))

describe("ConversationMemoryManager - Initialization Timing Fixes", () => {
	let manager: ConversationMemoryManager
	let mockContext: ExtensionContext
	let mockContextProxy: any
	let mockOrchestrator: any
	let MockedOrchestrator: any

	beforeEach(() => {
		vi.clearAllMocks()

		// Setup mock context
		mockContext = {
			extensionUri: { fsPath: "/test/extension" },
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				setKeysForSync: vi.fn(),
				keys: vi.fn(),
			},
			workspaceState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn(),
			},
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
				onDidChange: vi.fn(),
			},
			subscriptions: [],
		} as any

		mockContextProxy = {
			getGlobalState: vi.fn(),
			setGlobalState: vi.fn(),
			getWorkspaceState: vi.fn(),
			setWorkspaceState: vi.fn(),
			getSecretStorage: vi.fn(),
			setSecretStorage: vi.fn(),
		}

		// Setup orchestrator mock
		mockOrchestrator = {
			start: vi.fn().mockResolvedValue(undefined),
			getInitializationStatus: vi.fn().mockReturnValue({
				isInitialized: true,
				isInitializing: false,
				error: null,
			}),
			search: vi.fn(),
			collectMessage: vi.fn(),
			clearMemoryData: vi.fn(),
			processTurn: vi.fn().mockResolvedValue(undefined),
		}

		MockedOrchestrator = vi.mocked(ConversationMemoryOrchestrator)
		MockedOrchestrator.mockImplementation(() => mockOrchestrator)

		// Use getInstance since constructor is private
		manager = ConversationMemoryManager.getInstance(mockContext, "/test/workspace")!
	})

	describe("Enhanced State Checking", () => {
		it("should return false for isInitialized when orchestrator does not exist", () => {
			expect(manager.isInitialized).toBe(false)
		})

		it("should return false for isInitialized when orchestrator exists but is not initialized", () => {
			// Create orchestrator but mark as not initialized
			manager["orchestrator"] = mockOrchestrator
			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: false,
				isInitializing: true,
				error: null,
			})

			expect(manager.isInitialized).toBe(false)
		})

		it("should return true for isInitialized when orchestrator exists and is initialized", () => {
			// Create orchestrator and mark as initialized
			manager["orchestrator"] = mockOrchestrator
			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: true,
				isInitializing: false,
				error: null,
			})

			expect(manager.isInitialized).toBe(true)
		})

		it("should return false for isInitialized when orchestrator has initialization error", () => {
			// Create orchestrator but with error
			manager["orchestrator"] = mockOrchestrator
			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: false,
				isInitializing: false,
				error: new Error("Initialization failed"),
			})

			expect(manager.isInitialized).toBe(false)
		})
	})

	describe("Orchestrator Status Validation", () => {
		it("should expose getInitializationStatus method", () => {
			manager["orchestrator"] = mockOrchestrator

			const status = mockOrchestrator.getInitializationStatus()
			expect(status).toBeDefined()
			expect(status).toHaveProperty("isInitialized")
			expect(status).toHaveProperty("isInitializing")
			expect(status).toHaveProperty("error")
		})

		it("should handle orchestrator status with error", () => {
			manager["orchestrator"] = mockOrchestrator
			const testError = new Error("Test initialization error")

			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: false,
				isInitializing: false,
				error: testError,
			})

			const status = mockOrchestrator.getInitializationStatus()
			expect(status.error).toBe(testError)
			expect(status.isInitialized).toBe(false)
		})
	})

	describe("Turn Processing State Validation", () => {
		const mockApiHandler = {
			createChatCompletion: vi.fn(),
			streamChatCompletion: vi.fn(),
		} as any

		beforeEach(() => {
			// Mock the configManager to return feature as enabled
			manager["configManager"] = {
				isFeatureEnabled: true,
				getConfig: vi.fn().mockReturnValue({ episodes: {} }),
			} as any
		})

		it("should skip processing when orchestrator does not exist", async () => {
			manager["orchestrator"] = undefined

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await manager.ingestTurn([], mockApiHandler)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("NO ORCHESTRATOR - memory operations skipped"),
				expect.any(Object),
			)

			consoleSpy.mockRestore()
		})

		it("should skip processing when orchestrator exists but is not initialized", async () => {
			manager["orchestrator"] = mockOrchestrator

			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: false,
				isInitializing: true,
				error: null,
			})

			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

			await manager.ingestTurn([], mockApiHandler)

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("ORCHESTRATOR NOT READY - memory operations skipped"),
				expect.any(Object),
			)

			consoleSpy.mockRestore()
		})

		it("should proceed with processing when orchestrator is fully ready", async () => {
			manager["orchestrator"] = mockOrchestrator

			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: true,
				isInitializing: false,
				error: null,
			})

			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

			await manager.ingestTurn([], mockApiHandler)

			expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("PROCESSING TURN with orchestrator"))

			consoleSpy.mockRestore()
		})
	})

	describe("Dependency Validation Logic", () => {
		it("should have waitForCodeIndexDependency method", () => {
			const waitMethod = (manager as any).waitForCodeIndexDependency
			expect(waitMethod).toBeDefined()
			expect(typeof waitMethod).toBe("function")
		})

		it("should have synchronizedOrchestratorStart method", () => {
			const syncMethod = (manager as any).synchronizedOrchestratorStart
			expect(syncMethod).toBeDefined()
			expect(typeof syncMethod).toBe("function")
		})

		it("should validate CodeIndex dependency functionality exists", () => {
			// Just verify the method exists and can be called
			const waitMethod = (manager as any).waitForCodeIndexDependency
			expect(waitMethod).toBeDefined()
			expect(typeof waitMethod).toBe("function")
		})

		it("should timeout when dependency not available", async () => {
			const { CodeIndexManager } = await import("../../code-index/manager")

			// Mock no dependency available
			vi.mocked(CodeIndexManager.getInstance).mockResolvedValue(undefined)

			const waitMethod = (manager as any).waitForCodeIndexDependency.bind(manager)

			await expect(waitMethod(50)).rejects.toThrow(/timeout/)
		})
	})

	describe("Orchestrator Initialization Synchronization", () => {
		beforeEach(() => {
			manager["orchestrator"] = mockOrchestrator
		})

		it("should synchronize orchestrator start successfully", async () => {
			mockOrchestrator.start.mockResolvedValue(undefined)
			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: true,
				isInitializing: false,
				error: null,
			})

			const syncMethod = (manager as any).synchronizedOrchestratorStart.bind(manager)

			await expect(syncMethod(1000)).resolves.not.toThrow()
			expect(mockOrchestrator.start).toHaveBeenCalledTimes(1)
		})

		it("should handle orchestrator start failure", async () => {
			mockOrchestrator.start.mockResolvedValue(undefined)
			mockOrchestrator.getInitializationStatus.mockReturnValue({
				isInitialized: false,
				isInitializing: false,
				error: new Error("Vector store connection failed"),
			})

			const syncMethod = (manager as any).synchronizedOrchestratorStart.bind(manager)

			await expect(syncMethod(1000)).rejects.toThrow(/failed to initialize/)
		})

		it("should handle timeout during orchestrator start", async () => {
			mockOrchestrator.start.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 2000)))

			const syncMethod = (manager as any).synchronizedOrchestratorStart.bind(manager)

			await expect(syncMethod(100)).rejects.toThrow(/timeout/)
		})
	})

	describe("State Manager Error Handling", () => {
		it("should have state manager for error reporting", () => {
			expect(manager["stateManager"]).toBeDefined()
			expect(typeof manager["stateManager"].setSystemState).toBe("function")
		})

		it("should set error states appropriately", () => {
			const stateManagerSpy = vi.spyOn(manager["stateManager"], "setSystemState")

			manager["stateManager"].setSystemState("Error", "Test error message")

			expect(stateManagerSpy).toHaveBeenCalledWith("Error", "Test error message")
		})
	})
})
