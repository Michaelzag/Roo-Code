import { describe, it, expect, beforeEach, vi } from "vitest"

// Mock vscode module
vi.mock("vscode", () => ({
	EventEmitter: vi.fn().mockImplementation(() => ({
		fire: vi.fn(),
		event: vi.fn(),
		dispose: vi.fn(),
	})),
}))

import { ConversationMemoryStateManager } from "../state-manager"

describe("ConversationMemoryStateManager", () => {
	let stateManager: ConversationMemoryStateManager

	beforeEach(() => {
		stateManager = new ConversationMemoryStateManager()
	})

	describe("initial state", () => {
		it("should start in Standby state", () => {
			expect(stateManager.state).toBe("Standby")
			const status = stateManager.getCurrentStatus()
			expect(status.systemState).toBe("Standby")
			expect(status.systemMessage).toBe("")
		})
	})

	describe("setSystemState", () => {
		it("should update state and message", () => {
			stateManager.setSystemState("Indexed", "System ready")

			expect(stateManager.state).toBe("Indexed")
			expect(stateManager.getCurrentStatus().systemMessage).toBe("System ready")
		})

		it("should handle all state transitions", () => {
			stateManager.setSystemState("Indexing", "Processing")
			expect(stateManager.state).toBe("Indexing")

			stateManager.setSystemState("Indexed", "Complete")
			expect(stateManager.state).toBe("Indexed")

			stateManager.setSystemState("Error", "Failed")
			expect(stateManager.state).toBe("Error")

			stateManager.setSystemState("Standby", "Reset")
			expect(stateManager.state).toBe("Standby")
		})
	})

	describe("setProgress", () => {
		it("should update progress data", () => {
			stateManager.setProgress(5, 10)

			const status = stateManager.getCurrentStatus()
			expect(status.processedEpisodes).toBe(5)
			expect(status.totalEpisodes).toBe(10)
		})

		it("should maintain state when updating progress", () => {
			stateManager.setSystemState("Indexing", "Processing")
			stateManager.setProgress(3, 7)

			const status = stateManager.getCurrentStatus()
			expect(status.systemState).toBe("Indexing")
			expect(status.systemMessage).toBe("Processing")
			expect(status.processedEpisodes).toBe(3)
			expect(status.totalEpisodes).toBe(7)
		})
	})

	describe("getCurrentStatus", () => {
		it("should return complete status information", () => {
			stateManager.setSystemState("Indexed", "All done")
			stateManager.setProgress(10, 10)

			const status = stateManager.getCurrentStatus()
			expect(status).toEqual({
				systemState: "Indexed",
				systemMessage: "All done",
				processedEpisodes: 10,
				totalEpisodes: 10,
			})
		})
	})
})
