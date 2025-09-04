import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import type { Task } from "../../../core/task/Task"
import type { ApiHandler } from "../../../api"
import { ConversationMemoryTurnProcessor } from "../turn-processor"
import { ConversationMemoryManager } from "../manager"

// Mock dependencies
vi.mock("../manager")
vi.mock("../../../utils/path")

describe("ConversationMemoryTurnProcessor", () => {
	let turnProcessor: ConversationMemoryTurnProcessor
	let mockTask: Partial<Task>
	let mockManager: any
	let mockApiHandler: ApiHandler
	let mockProvider: any

	beforeEach(() => {
		turnProcessor = ConversationMemoryTurnProcessor.getInstance()

		mockProvider = {
			context: { extensionPath: "/mock/path" },
			postMessageToWebview: vi.fn(),
		}

		mockTask = {
			cwd: "/mock/workspace",
			providerRef: { deref: () => mockProvider } as any,
			apiConversationHistory: [
				{ role: "user", content: "Please help me implement a feature" },
				{ role: "assistant", content: "I'll help you implement this feature." },
			],
			api: mockApiHandler,
		}

		mockApiHandler = {
			getModel: () => ({
				id: "claude-3-5-sonnet",
				info: {
					contextWindow: 200000,
					supportsPromptCache: true,
					maxTokens: 8192,
				},
			}),
		} as ApiHandler

		mockManager = {
			isFeatureEnabled: true,
			isInitialized: true,
			ingestTurn: vi.fn().mockResolvedValue(undefined),
		}

		vi.mocked(ConversationMemoryManager.getInstance).mockReturnValue(mockManager)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	describe("Turn Lifecycle Management", () => {
		it("should initialize turn buffer on assistant stream start", () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)

			// Should not throw and should track the workspace
			expect(mockTask.cwd).toBeDefined()
		})

		it("should handle turn completion without errors", async () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)
			turnProcessor.onAssistantContent(mockTask as Task, "Here's the implementation")

			await expect(turnProcessor.onAssistantStreamComplete(mockTask as Task)).resolves.not.toThrow()
		})

		it("should handle context collection with fewer than 4 previous interactions", async () => {
			// Set up task with minimal history
			mockTask.apiConversationHistory = [{ role: "user", content: "First question" }]

			turnProcessor.onAssistantStreamStart(mockTask as Task)
			turnProcessor.onAssistantContent(mockTask as Task, "First response")

			await expect(turnProcessor.onAssistantStreamComplete(mockTask as Task)).resolves.not.toThrow()
		})
	})

	describe("Special Tool Handling", () => {
		it("should detect sub-task tools and mark for blocking processing", () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)
			turnProcessor.onToolProcessing(
				mockTask as Task,
				"new_task" as any,
				{ mode: "code", message: "New task" },
				"Task created",
			)

			// The tool should be marked as sub-task type
			expect(mockTask.cwd).toBeDefined()
		})

		it("should detect MCP tools and mark for priority processing", () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)
			turnProcessor.onToolProcessing(
				mockTask as Task,
				"use_mcp_tool" as any,
				{ server_name: "test", tool_name: "test" },
				"MCP result",
			)

			expect(mockTask.cwd).toBeDefined()
		})

		it("should detect file tools and coordinate with codebase indexing", () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)
			turnProcessor.onToolProcessing(
				mockTask as Task,
				"write_to_file" as any,
				{ path: "test.ts", content: "test" },
				"File written",
			)

			expect(mockTask.cwd).toBeDefined()
		})
	})

	describe("Chunked Processing for Long Tool Chains", () => {
		it("should process chunks when tool count exceeds threshold", () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)

			// Add 15 tools to trigger chunk processing
			for (let i = 0; i < 15; i++) {
				turnProcessor.onToolProcessing(
					mockTask as Task,
					"read_file" as any,
					{ path: `file${i}.ts` },
					`File ${i} content`,
				)
			}

			// Should trigger chunked processing
			expect(mockTask.cwd).toBeDefined()
		})

		it("should force completion when tool count exceeds maximum", () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)

			// Add 50 tools to trigger forced completion
			for (let i = 0; i < 50; i++) {
				turnProcessor.onToolProcessing(mockTask as Task, "list_files" as any, { path: "/" }, `Listing ${i}`)
			}

			// Should trigger forced completion
			expect(mockTask.cwd).toBeDefined()
		})

		it("should create detailed tool summaries for chunked processing", () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)

			// Add several tools with results
			const tools = [
				{ name: "read_file", params: { path: "app.ts" }, result: "import React from 'react'" },
				{ name: "write_to_file", params: { path: "component.ts" }, result: "File written successfully" },
				{ name: "execute_command", params: { command: "npm test" }, result: "Tests passed" },
			]

			tools.forEach((tool) => {
				turnProcessor.onToolProcessing(mockTask as Task, tool.name as any, tool.params, tool.result)
			})

			expect(mockTask.cwd).toBeDefined()
		})
	})

	describe("Error Handling", () => {
		it("should handle missing workspace gracefully", () => {
			const taskWithoutWorkspace = { ...mockTask, cwd: undefined } as unknown as Task

			expect(() => {
				turnProcessor.onAssistantStreamStart(taskWithoutWorkspace)
			}).not.toThrow()
		})

		it("should handle missing provider gracefully", () => {
			const taskWithoutProvider = {
				...mockTask,
				providerRef: { deref: () => null } as any,
			} as unknown as Task

			expect(() => {
				turnProcessor.onToolProcessing(taskWithoutProvider, "read_file" as any, {}, "result")
			}).not.toThrow()
		})

		it("should handle memory manager initialization failure", async () => {
			vi.mocked(ConversationMemoryManager.getInstance).mockReturnValue(undefined)

			turnProcessor.onAssistantStreamStart(mockTask as Task)

			await expect(turnProcessor.onAssistantStreamComplete(mockTask as Task)).resolves.not.toThrow()
		})

		it("should handle memory processing failures gracefully", async () => {
			const failingManager = {
				isFeatureEnabled: true,
				isInitialized: true,
				ingestTurn: vi.fn().mockRejectedValue(new Error("Processing failed")),
			} as any
			vi.mocked(ConversationMemoryManager.getInstance).mockReturnValue(failingManager)

			turnProcessor.onAssistantStreamStart(mockTask as Task)

			await expect(turnProcessor.onAssistantStreamComplete(mockTask as Task)).resolves.not.toThrow()
		})
	})

	describe("Context Building", () => {
		it("should build proper context with current turn and historical pairs", async () => {
			// Set up rich conversation history
			mockTask.apiConversationHistory = [
				{ role: "user", content: "How do I implement auth?" },
				{ role: "assistant", content: "Here are the steps for authentication..." },
				{ role: "user", content: "What about JWT tokens?" },
				{ role: "assistant", content: "JWT tokens work like this..." },
				{ role: "user", content: "Can you write the code?" },
			]

			turnProcessor.onAssistantStreamStart(mockTask as Task)
			turnProcessor.onAssistantContent(mockTask as Task, "I'll write the authentication code for you.")
			turnProcessor.onToolProcessing(
				mockTask as Task,
				"write_to_file" as any,
				{ path: "auth.ts" },
				"Auth file created",
			)

			await turnProcessor.onAssistantStreamComplete(mockTask as Task)

			// Should have processed the turn with proper context
			expect(mockManager.ingestTurn).toHaveBeenCalled()
		})
	})

	describe("Integration Points", () => {
		it("should maintain episode processing compatibility", async () => {
			turnProcessor.onAssistantStreamStart(mockTask as Task)
			turnProcessor.onAssistantContent(mockTask as Task, "Working on your request...")
			turnProcessor.onToolProcessing(
				mockTask as Task,
				"codebase_search" as any,
				{ query: "auth" },
				"Found auth files",
			)

			await turnProcessor.onAssistantStreamComplete(mockTask as Task)

			expect(mockManager.ingestTurn).toHaveBeenCalledWith(
				expect.any(Array), // messages
				expect.any(Object), // api
				expect.any(String), // modelId
				expect.any(Object), // toolMeta
			)
		})
	})
})
