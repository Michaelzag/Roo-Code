import { describe, it, expect, beforeEach, vi } from "vitest"
import type { ClineMessage } from "@roo-code/types"
import { useFactoryMessageClassification } from "../useFactoryMessageClassification"
import { renderHook } from "@testing-library/react"

// Mock the safeJsonParse utility
vi.mock("@roo/safeJsonParse", () => ({
	safeJsonParse: (text: string) => {
		try {
			return JSON.parse(text)
		} catch {
			return null
		}
	},
}))

describe("Factory Message Classification", () => {
	let hook: ReturnType<typeof useFactoryMessageClassification>

	beforeEach(() => {
		const { result } = renderHook(() => useFactoryMessageClassification())
		hook = result.current
	})

	describe("Tool Operation Classification", () => {
		it("should classify successful readFile as file-read operation", () => {
			const message: ClineMessage = {
				type: "say",
				say: "error", // This is the key issue - backend sends success as "error"
				text: JSON.stringify({
					tool: "readFile",
					path: ".roo/rules-publishing-agent/1_deployment_workflow.xml",
					isOutsideWorkspace: false,
					content:
						"/home/michael/projects/production_app/.roo/rules-publishing-agent/1_deployment_workflow.xml",
					reason: "",
				}),
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			expect(result.semantic).toBe("file-read")
			expect(result.color).toBe("cyan")
			expect(result.pattern).toBe("bubble")
			expect(result.variant).toBe("work")
		})

		it("should classify successful appliedDiff as file-write operation", () => {
			const message: ClineMessage = {
				type: "say",
				say: "error", // Misclassified by backend
				text: JSON.stringify({
					tool: "appliedDiff",
					path: ".roo/rules-shared/4_rule_distribution_analysis.xml",
				}),
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			expect(result.semantic).toBe("file-write")
			expect(result.color).toBe("orange")
			expect(result.pattern).toBe("bubble")
			expect(result.variant).toBe("work")
		})

		it("should classify failed tool operations as errors", () => {
			const message: ClineMessage = {
				type: "say",
				say: "error",
				text: JSON.stringify({
					tool: "appliedDiff",
					path: ".roo/rules-shared/4_rule_distribution_analysis.xml",
					error: "Special marker '<<<<<<< SEARCH>' found in your diff content",
					failed: true,
				}),
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			expect(result.semantic).toBe("error")
			expect(result.color).toBe("red")
			expect(result.pattern).toBe("bubble")
			expect(result.variant).toBe("work")
		})
	})

	describe("Error Message Classification", () => {
		it("should classify specific diff_error with full bubble", () => {
			const message: ClineMessage = {
				type: "say",
				say: "diff_error",
				text: "ERROR: Special marker '<<<<<<< SEARCH>' found in your diff content at line 2...",
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			expect(result.semantic).toBe("error")
			expect(result.color).toBe("red")
			expect(result.pattern).toBe("bubble")
			expect(result.variant).toBe("work")
		})

		it("should suppress generic error when specific error exists", () => {
			const message: ClineMessage = {
				type: "say",
				say: "error",
				text: JSON.stringify({
					tool: "appliedDiff",
					path: ".roo/rules-shared/4_rule_distribution_analysis.xml",
				}),
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			// Should be classified as successful operation, not error
			expect(result.semantic).toBe("file-write")
			expect(result.pattern).toBe("bubble")
		})
	})

	describe("User Input Classification", () => {
		it("should classify user_feedback as user-input", () => {
			const message: ClineMessage = {
				type: "say",
				say: "user_feedback",
				text: "Please fix the CSS styling",
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			expect(result.semantic).toBe("user-input")
			expect(result.color).toBe("blue")
			expect(result.variant).toBe("user")
		})
	})

	describe("Agent Response Classification", () => {
		it("should classify text messages as agent-response", () => {
			const message: ClineMessage = {
				type: "say",
				say: "text",
				text: "I'll help you with that CSS styling issue.",
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			expect(result.semantic).toBe("agent-response")
			expect(result.color).toBe("green")
			expect(result.variant).toBe("agent")
		})
	})

	describe("Factory Registry", () => {
		it("should provide registry information for debugging", () => {
			const info = hook.getRegistryInfo()

			expect(info.parsers).toHaveLength(5)
			expect(info.classifiers).toHaveLength(5)

			// Check that factories are registered with correct priorities
			const toolParser = info.parsers.find((p) => p.name === "ToolOperationParser")
			expect(toolParser?.priority).toBe(100)

			const errorParser = info.parsers.find((p) => p.name === "ErrorMessageParser")
			expect(errorParser?.priority).toBe(90)
		})
	})

	describe("Fallback Handling", () => {
		it("should handle unknown message types gracefully", () => {
			const message: ClineMessage = {
				type: "say",
				say: "unknown_future_type" as any,
				text: "Some unknown message",
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			// Should fall back to safe defaults
			expect(result.semantic).toBe("search")
			expect(result.color).toBe("pink")
			expect(result.pattern).toBe("bubble")
			expect(result.variant).toBe("work")
		})

		it("should handle malformed JSON gracefully", () => {
			const message: ClineMessage = {
				type: "say",
				say: "error",
				text: "{ invalid json",
				ts: Date.now(),
			}

			const result = hook.classifyMessage(message)

			// Should classify as error since it's say:error with no valid tool data
			expect(result.semantic).toBe("error")
			expect(result.pattern).toBe("bubble")
		})
	})
})
