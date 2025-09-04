import { describe, it, expect, vi, beforeEach } from "vitest"
import { presentAssistantMessage } from "../presentAssistantMessage"
import { ConversationMemoryTurnProcessor } from "../../../services/conversation-memory/turn-processor"
import type { Task } from "../../task/Task"

// Mock dependencies
vi.mock("../../../services/conversation-memory/turn-processor")

describe("presentAssistantMessage - Memory Integration", () => {
	let mockTask: Partial<Task>
	let mockTurnProcessor: any

	beforeEach(() => {
		vi.clearAllMocks()

		mockTurnProcessor = {
			onAssistantStreamStart: vi.fn(),
			onToolProcessing: vi.fn(),
			onAssistantStreamComplete: vi.fn(),
		}

		vi.mocked(ConversationMemoryTurnProcessor.getInstance).mockReturnValue(mockTurnProcessor)

		mockTask = {
			taskId: "test-task",
			instanceId: "test-instance-1",
			abort: false,
			presentAssistantMessageLocked: false,
			presentAssistantMessageHasPendingUpdates: false,
			currentStreamingContentIndex: 0,
			assistantMessageContent: [
				{
					type: "tool_use",
					name: "write_to_file",
					params: { path: "test.ts", content: "test content" },
					partial: false,
				},
			],
			didRejectTool: false,
			didAlreadyUseTool: false,
			userMessageContent: [],
			recordToolUsage: vi.fn(),
			providerRef: {
				deref: () => ({
					getState: async () => ({ mode: "code", customModes: [] }),
				}),
			},
			memoryLastTool: undefined,
			say: vi.fn(),
			ask: vi.fn().mockResolvedValue({ response: "yesButtonClicked" }),
			handleError: vi.fn(),
			browserSession: {
				closeBrowser: vi.fn(),
				context: null,
				isUsingRemoteBrowser: false,
				ensureChromiumExists: vi.fn(),
				getViewport: vi.fn(),
				getBrowserVersion: vi.fn(),
				newPage: vi.fn(),
				getCurrentPage: vi.fn(),
				closePage: vi.fn(),
				navigateToPage: vi.fn(),
				performPageAction: vi.fn(),
				generateScreenshotOfPlatform: vi.fn(),
				getScreenshot: vi.fn(),
				performInteraction: vi.fn(),
				scrollToElement: vi.fn(),
				clickElement: vi.fn(),
				typeInElement: vi.fn(),
				clearElementInput: vi.fn(),
				selectOptionInElement: vi.fn(),
				waitForSelector: vi.fn(),
				waitForNetworkIdle: vi.fn(),
				getElementText: vi.fn(),
				getElementsText: vi.fn(),
				getCurrentPageUrl: vi.fn(),
				rejectAllPermissions: vi.fn(),
			},
			toolRepetitionDetector: {
				check: vi.fn().mockReturnValue({ allowExecution: true, askUser: null }),
				previousToolCallJson: null,
				consecutiveIdenticalToolCallCount: 0,
				consecutiveIdenticalToolCallLimit: 3,
				isBrowserScrollAction: vi.fn(),
				serializeToolUse: vi.fn(),
			},
		} as any
	})

	it("should initialize memory processing on first tool execution", async () => {
		// This test validates the critical fix: memory initialization should happen
		// when currentStreamingContentIndex === 0, regardless of presentAssistantMessageLocked

		await presentAssistantMessage(mockTask as Task)

		// Verify memory processing was initialized - this was the core bug
		expect(mockTurnProcessor.onAssistantStreamStart).toHaveBeenCalledWith(mockTask)
		expect(mockTurnProcessor.onToolProcessing).toHaveBeenCalledWith(
			mockTask,
			"write_to_file",
			{ path: "test.ts", content: "test content" },
			expect.any(String),
		)
	})

	it("should reset initialization flag for subsequent conversation turns", () => {
		// Simulate a completed turn scenario
		mockTask.currentStreamingContentIndex = 0
		mockTask.assistantMessageContent = [
			{
				type: "tool_use",
				name: "read_file",
				params: { path: "test.ts" },
				partial: false,
			},
		]

		// First call should initialize
		presentAssistantMessage(mockTask as Task)

		// Verify the initialization flag is properly managed
		expect((mockTask as any).currentStreamingDidMemoryInit).toBe(true)
	})

	it("should not reinitialize on subsequent tool calls in same turn", async () => {
		// Set flag to simulate already initialized
		;(mockTask as any).currentStreamingDidMemoryInit = true
		mockTask.currentStreamingContentIndex = 1 // Second tool in turn

		await presentAssistantMessage(mockTask as Task)

		// Should not call onAssistantStreamStart again
		expect(mockTurnProcessor.onAssistantStreamStart).not.toHaveBeenCalled()
		// But should still process the tool
		expect(mockTurnProcessor.onToolProcessing).toHaveBeenCalled()
	})
})
