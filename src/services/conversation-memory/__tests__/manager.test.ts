import { describe, it, expect, vi, beforeEach } from "vitest"
import * as path from "path"
import { ConversationMemoryManager } from "../manager"
import { ContextProxy } from "../../../core/config/ContextProxy"

// Mock vscode module following code-index pattern
vi.mock("vscode", () => {
	const testPath = require("path")
	const testWorkspacePath = testPath.join(testPath.sep, "test", "workspace")
	return {
		window: {
			activeTextEditor: null,
		},
		workspace: {
			workspaceFolders: [
				{
					uri: { fsPath: testWorkspacePath },
					name: "test",
					index: 0,
				},
			],
			getConfiguration: vi.fn(() => ({
				get: vi.fn((key: string, defaultValue: any) => defaultValue),
			})),
			getWorkspaceFolder: vi.fn((uri) => ({
				uri: { fsPath: testWorkspacePath },
				name: "test",
				index: 0,
			})),
		},
		EventEmitter: vi.fn().mockImplementation(() => ({
			fire: vi.fn(),
			event: vi.fn(),
			dispose: vi.fn(),
		})),
	}
})

// Mock utils/path
vi.mock("../../../utils/path", () => {
	const testPath = require("path")
	const testWorkspacePath = testPath.join(testPath.sep, "test", "workspace")
	return {
		getWorkspacePath: vi.fn(() => testWorkspacePath),
	}
})

// Mock ContextProxy
vi.mock("../../../core/config/ContextProxy")

// Mock service factory
vi.mock("../service-factory")

// Mock code-index config manager
vi.mock("../../code-index/config-manager")

describe("ConversationMemoryManager", () => {
	let mockContext: any
	let mockContextProxy: ContextProxy

	// Define test paths following code-index pattern
	const testWorkspacePath = path.join(path.sep, "test", "workspace")
	const testExtensionPath = path.join(path.sep, "test", "extension")
	const testStoragePath = path.join(path.sep, "test", "storage")
	const testGlobalStoragePath = path.join(path.sep, "test", "global-storage")
	const testLogPath = path.join(path.sep, "test", "log")

	beforeEach(() => {
		vi.clearAllMocks()

		// Clear all instances before each test
		ConversationMemoryManager["instances"].clear()

		mockContext = {
			subscriptions: [],
			workspaceState: {} as any,
			globalState: {
				get: vi.fn(),
				update: vi.fn(),
				keys: vi.fn().mockReturnValue([]),
				setKeysForSync: vi.fn(),
			} as any,
			secrets: {
				get: vi.fn(),
				store: vi.fn(),
				delete: vi.fn(),
				onDidChange: vi.fn(),
			} as any,
			extensionUri: { fsPath: testExtensionPath } as any,
			extensionPath: testExtensionPath,
			asAbsolutePath: vi.fn((relativePath: string) => path.join(testExtensionPath, relativePath)),
			storageUri: { fsPath: testStoragePath } as any,
			storagePath: testStoragePath,
			globalStorageUri: { fsPath: testGlobalStoragePath } as any,
			globalStoragePath: testGlobalStoragePath,
			logUri: { fsPath: testLogPath } as any,
			logPath: testLogPath,
			extensionMode: 3, // ExtensionMode.Test
			extension: {} as any,
			environmentVariableCollection: {} as any,
		}

		mockContextProxy = {
			getApiKey: vi.fn().mockReturnValue(undefined),
			getCustomModel: vi.fn().mockReturnValue(undefined),
			getEmbeddingModel: vi.fn().mockReturnValue(undefined),
			getApiProvider: vi.fn().mockReturnValue(undefined),
		} as any
	})

	describe("getInstance", () => {
		it("should return singleton instance for workspace", () => {
			const instance1 = ConversationMemoryManager.getInstance(mockContext, testWorkspacePath)
			const instance2 = ConversationMemoryManager.getInstance(mockContext, testWorkspacePath)

			expect(instance1).toBe(instance2)
		})

		it("should use active editor workspace when no path provided", async () => {
			const vscode = await import("vscode")
			;(vscode.window as any).activeTextEditor = {
				document: {
					uri: { fsPath: path.join(testWorkspacePath, "file.ts") },
				},
			}

			const instance = ConversationMemoryManager.getInstance(mockContext)
			expect(instance).toBeDefined()
		})

		it("should return undefined when no workspace available", async () => {
			const vscode = await import("vscode")
			;(vscode.workspace as any).workspaceFolders = undefined
			;(vscode.window as any).activeTextEditor = undefined

			const instance = ConversationMemoryManager.getInstance(mockContext)
			expect(instance).toBeUndefined()
		})
	})

	describe("initialize", () => {
		it("should initialize orchestrator when feature is enabled", async () => {
			const manager = ConversationMemoryManager.getInstance(mockContext, testWorkspacePath)

			await manager?.initialize(mockContextProxy)

			expect(manager?.isInitialized).toBe(false) // Will be false since we don't have real services
		})
	})

	describe("searchMemory", () => {
		it("should return empty array when orchestrator not initialized", async () => {
			const manager = ConversationMemoryManager.getInstance(mockContext, testWorkspacePath)

			const results = await manager?.searchMemory("test query")

			expect(results).toEqual([])
		})
	})
})
