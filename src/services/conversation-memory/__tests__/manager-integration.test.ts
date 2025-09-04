import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ConversationMemoryManager } from "../manager"
import { ConversationMemoryOrchestrator } from "../orchestrator"
import { RooApiLlmProviderAdapter } from "../adapters/roo-api-llm-adapter"
import type { ApiHandler } from "../../../api"
import type { Message } from "../types"

// Mock VSCode API
vi.mock("vscode", () => {
	const MockEventEmitter = vi.fn().mockImplementation(() => ({
		event: vi.fn(),
		fire: vi.fn(),
		dispose: vi.fn(),
	}))

	return {
		EventEmitter: MockEventEmitter,
		Uri: { file: vi.fn((path: string) => ({ fsPath: path })) },
		workspace: {
			workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
			getWorkspaceFolder: vi.fn(),
			getConfiguration: vi.fn(() => ({
				get: vi.fn(() => undefined),
			})),
		},
		window: { activeTextEditor: null },
	}
})

// Mock path utils
vi.mock("../../../utils/path", () => ({
	getWorkspacePath: vi.fn(() => "/test/workspace"),
}))

// Mock ContextProxy
vi.mock("../../../core/config/ContextProxy", () => ({
	ContextProxy: vi.fn().mockImplementation(() => ({
		getGlobalState: vi.fn(() => ({
			codebaseIndexEnabled: true,
			codebaseIndexQdrantUrl: "http://localhost:6333",
		})),
		setGlobalState: vi.fn(),
		getWorkspaceState: vi.fn(() => ({})),
		setWorkspaceState: vi.fn(),
		getConfiguration: vi.fn(() => ({})),
		getValues: vi.fn(() => ({})),
		getSecret: vi.fn(() => "test-api-key"),
	})),
}))

// Mock CodeIndexManager
const mockCodeIndexConfigManager = vi.fn().mockImplementation(() => ({
	isFeatureConfigured: true,
	isFeatureEnabled: true,
	qdrantConfig: { url: "http://localhost:6333", apiKey: "test" },
	currentModelDimension: 1536,
	getConfig: vi.fn(() => ({
		embedderProvider: "openai",
		modelId: "text-embedding-ada-002",
		openAiOptions: { openAiNativeApiKey: "test-key" },
	})),
}))

vi.mock("../../code-index/manager", () => ({
	CodeIndexManager: {
		getInstance: vi.fn(() => ({
			isFeatureEnabled: true,
			isInitialized: true,
			getConfigManager: vi.fn(() => mockCodeIndexConfigManager()),
			onFilesIndexed: vi.fn(),
		})),
	},
}))

// Mock orchestrator file event handler
vi.mock("../orchestrator", async (importOriginal) => {
	const original = (await importOriginal()) as any
	return {
		...original,
		handleFilesIndexed: vi.fn(),
	}
})

/**
 * Integration tests for ConversationMemoryManager based on current implementation.
 * Tests the actual turn ingestion flow from manager.ingestTurn() through orchestrator.
 */
describe("ConversationMemoryManager Integration", () => {
	let mockContext: any
	let mockApiHandler: ApiHandler
	let mockStream: AsyncIterableIterator<any>
	let manager: ConversationMemoryManager
	let originalProcessTurn: any

	beforeEach(async () => {
		// Reset all instances to avoid cross-test pollution
		;(ConversationMemoryManager as any).instances.clear()

		mockContext = {
			extensionPath: "/test",
			globalState: { get: vi.fn(), update: vi.fn() },
			workspaceState: { get: vi.fn(), update: vi.fn() },
			subscriptions: [],
		}

		// Setup successful fact extraction by default
		mockStream = {
			async *[Symbol.asyncIterator]() {
				yield {
					type: "text",
					text: JSON.stringify({
						facts: [
							{
								content: "User implemented JWT authentication using express middleware",
								category: "architecture",
								confidence: 0.85,
							},
						],
					}),
				}
			},
			next: vi.fn(),
			return: vi.fn(),
			throw: vi.fn(),
		}

		mockApiHandler = {
			createMessage: vi.fn().mockReturnValue(mockStream),
			currentModel: "gpt-4o-mini",
		} as any

		manager = ConversationMemoryManager.getInstance(mockContext, "/test/workspace")!

		// Mock the orchestrator's processTurn method to spy on calls
		originalProcessTurn = ConversationMemoryOrchestrator.prototype.processTurn
		ConversationMemoryOrchestrator.prototype.processTurn = vi.fn().mockResolvedValue(undefined)
	})

	afterEach(() => {
		// Restore original method
		if (originalProcessTurn) {
			ConversationMemoryOrchestrator.prototype.processTurn = originalProcessTurn
		}
	})

	describe("Turn-Level Ingestion (Happy Path)", () => {
		it("should successfully ingest turn with facts via manager.ingestTurn", async () => {
			// Initialize the manager (required for orchestrator setup)
			const mockContextProxy = {} as any
			await manager.initialize(mockContextProxy)

			const messages: Message[] = [
				{ role: "user", content: "How do I implement JWT authentication?" },
				{ role: "assistant", content: "Use express-jwt middleware with jsonwebtoken library." },
			]

			await manager.ingestTurn(messages, mockApiHandler, "gpt-4o-mini")

			// Verify processTurn was called with correct parameters
			expect(ConversationMemoryOrchestrator.prototype.processTurn).toHaveBeenCalledWith(
				messages,
				expect.any(RooApiLlmProviderAdapter),
				expect.objectContaining({
					modelId: "gpt-4o-mini",
				}),
			)
		})

		it("should include tool metadata when provided", async () => {
			const mockContextProxy = {} as any
			await manager.initialize(mockContextProxy)

			const messages: Message[] = [{ role: "user", content: "Search for authentication code" }]

			const toolMeta = {
				name: "codebase_search",
				params: { query: "authentication" },
				resultText: "Found auth.ts with JWT implementation",
			}

			await manager.ingestTurn(messages, mockApiHandler, "gpt-4o-mini", toolMeta)

			expect(ConversationMemoryOrchestrator.prototype.processTurn).toHaveBeenCalledWith(
				messages,
				expect.any(RooApiLlmProviderAdapter),
				expect.objectContaining({
					modelId: "gpt-4o-mini",
					toolMeta,
				}),
			)
		})
	})

	describe("Manager State Handling", () => {
		it("should return early if orchestrator not initialized", async () => {
			// Don't call initialize() - orchestrator should be undefined
			const messages: Message[] = [{ role: "user", content: "Test message" }]

			await manager.ingestTurn(messages, mockApiHandler, "gpt-4o-mini")

			// Should not call processTurn if orchestrator not available
			expect(ConversationMemoryOrchestrator.prototype.processTurn).not.toHaveBeenCalled()
		})

		it("should handle search requests when orchestrator available", async () => {
			const mockContextProxy = {} as any
			await manager.initialize(mockContextProxy)

			// Mock orchestrator search method
			const mockSearch = vi.fn().mockResolvedValue([{ content: "Found memory", score: 0.8 }])
			;(manager as any).orchestrator.search = mockSearch

			const results = await manager.searchMemory("JWT authentication")

			expect(mockSearch).toHaveBeenCalledWith("JWT authentication")
			expect(results).toEqual([{ content: "Found memory", score: 0.8 }])
		})

		it("should return empty array for search when orchestrator unavailable", async () => {
			// Don't initialize - orchestrator should be undefined
			const results = await manager.searchMemory("test query")
			expect(results).toEqual([])
		})
	})

	describe("Code Index Event Subscription", () => {
		it("should subscribe to Code Index events during initialization", async () => {
			const mockContextProxy = {} as any
			const mockCodeIndexManager = {
				isFeatureEnabled: true,
				onFilesIndexed: vi.fn(),
			}

			// Mock the CodeIndexManager.getInstance to return our mock
			vi.doMock("../../code-index/manager", () => ({
				CodeIndexManager: {
					getInstance: vi.fn(() => mockCodeIndexManager),
				},
			}))

			await manager.initialize(mockContextProxy)

			expect(mockCodeIndexManager.onFilesIndexed).toHaveBeenCalled()
		})

		it("should handle Code Index manager unavailability gracefully", async () => {
			const mockContextProxy = {} as any

			// Mock CodeIndexManager to return undefined
			vi.doMock("../../code-index/manager", () => ({
				CodeIndexManager: {
					getInstance: vi.fn(() => undefined),
				},
			}))

			// Should not throw when Code Index manager is unavailable
			await expect(manager.initialize(mockContextProxy)).resolves.not.toThrow()
		})
	})

	describe("Workspace Isolation", () => {
		it("should create separate instances per workspace", () => {
			const manager1 = ConversationMemoryManager.getInstance(mockContext, "/workspace1")
			const manager2 = ConversationMemoryManager.getInstance(mockContext, "/workspace2")
			const manager1Again = ConversationMemoryManager.getInstance(mockContext, "/workspace1")

			expect(manager1).not.toBe(manager2)
			expect(manager1).toBe(manager1Again) // Same instance for same workspace
		})

		it("should detect workspace from active editor when not provided", () => {
			const mockActiveEditor = {
				document: { uri: { fsPath: "/detected/workspace/file.ts" } },
			}
			const mockWorkspaceFolder = {
				uri: { fsPath: "/detected/workspace" },
			}

			// Mock vscode.window.activeTextEditor and workspace.getWorkspaceFolder
			const vscode = require("vscode")
			vscode.window.activeTextEditor = mockActiveEditor
			vscode.workspace.getWorkspaceFolder = vi.fn(() => mockWorkspaceFolder)

			const manager = ConversationMemoryManager.getInstance(mockContext)

			expect(manager).toBeDefined()
			expect(vscode.workspace.getWorkspaceFolder).toHaveBeenCalledWith(mockActiveEditor.document.uri)
		})
	})

	describe("Feature Enable/Disable State", () => {
		it("should respect feature enabled state", async () => {
			const mockContextProxy = {} as any

			// Mock configManager to return disabled
			const mockConfigManager = { isFeatureEnabled: false }
			;(manager as any).configManager = mockConfigManager

			await manager.initialize(mockContextProxy)

			// Should not create orchestrator if feature disabled
			expect(manager.isInitialized).toBe(false)
		})

		it("should report feature state correctly", () => {
			const mockConfigManager = { isFeatureEnabled: true }
			;(manager as any).configManager = mockConfigManager

			expect(manager.isFeatureEnabled).toBe(true)

			mockConfigManager.isFeatureEnabled = false
			expect(manager.isFeatureEnabled).toBe(false)
		})
	})
})
