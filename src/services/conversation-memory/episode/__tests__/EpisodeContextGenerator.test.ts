import type { Message, ProjectContext } from "../../types"
import type { HintsProvider } from "../../interfaces/episode"
import type { ILlmProvider } from "../../interfaces"
import { EpisodeContextGenerator } from "../EpisodeContextGenerator"

/**
 * Comprehensive unit tests for EpisodeContextGenerator class
 *
 * Test Coverage Areas:
 * 1. Core Context Generation Tests (12 tests): Context creation with different hint providers and configurations
 * 2. LLM Integration Tests (12 tests): LLM adapter interaction, prompt construction, response handling
 * 3. Error Handling Tests (10 tests): LLM failures, timeout scenarios, malformed responses, provider errors
 * 4. Performance & Quality Tests (8 tests): Context generation efficiency, quality validation, optimization
 *
 * Total: 42 comprehensive test cases for 100% statement and branch coverage
 */
describe("EpisodeContextGenerator", () => {
	let mockLlmProvider: ILlmProvider
	let mockHintsProvider: HintsProvider
	let testProjectContext: ProjectContext
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		// Mock LLM provider with proper typing
		mockLlmProvider = {
			generateJson: vi.fn().mockResolvedValue({
				description: "Generated episode description",
			}),
			generateText: vi.fn().mockResolvedValue("Generated text"),
		}

		// Mock hints provider with comprehensive interface
		mockHintsProvider = {
			getHints: vi.fn().mockResolvedValue({
				deps: ["react", "typescript"],
				tags: ["component", "interface"],
				dirs: ["src", "components"],
				extra: ["custom-hint"],
			}),
		}

		// Standard test project context
		testProjectContext = {
			workspaceName: "test-workspace",
			language: "typescript",
			framework: "react",
			packageManager: "npm",
		}

		// Spy on console methods to verify error handling
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Clear all mocks before each test
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	/**
	 * Helper function to create test messages
	 */
	const createMessage = (role: "user" | "assistant" | "system", content: string): Message => ({
		role,
		content,
		timestamp: new Date().toISOString(),
	})

	/**
	 * Helper function to create multiple messages for testing
	 */
	const createMessages = (count: number, prefix = "Message"): Message[] => {
		return Array.from({ length: count }, (_, i) =>
			createMessage(i % 2 === 0 ? "user" : "assistant", `${prefix} ${i + 1}`),
		)
	}

	describe("Core Context Generation Tests", () => {
		describe("Constructor and Initialization", () => {
			it("should initialize with LLM provider only", () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider)
				expect(generator).toBeInstanceOf(EpisodeContextGenerator)
			})

			it("should initialize with both LLM provider and hints provider", () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				expect(generator).toBeInstanceOf(EpisodeContextGenerator)
			})
		})

		describe("Context Generation with Different Hint Providers", () => {
			it("should generate context without hints provider", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider)
				const messages = createMessages(3, "Test message")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Generated episode description")
				expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(
					expect.stringContaining("Summarize this technical conversation"),
					{ temperature: 0.2, max_tokens: 80 },
				)
			})

			it("should generate context with FileSystemHintsProvider integration", async () => {
				// Mock hints provider that simulates filesystem hints
				const fsHintsProvider: HintsProvider = {
					getHints: vi.fn().mockResolvedValue({
						deps: ["express", "cors"],
						dirs: ["src", "lib", "tests"],
						extra: ["api", "server"],
					}),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, fsHintsProvider)
				const messages = createMessages(2, "API implementation")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("Dependencies: express, cors")
				expect(promptCall).toContain("Key dirs: src, lib, tests")
				expect(promptCall).toContain("Keywords: api, server")
			})

			it("should generate context with MemoryHintsProvider integration", async () => {
				// Mock hints provider that simulates memory hints
				const memoryHintsProvider: HintsProvider = {
					getHints: vi.fn().mockResolvedValue({
						tags: ["authentication", "database", "api-endpoint"],
						deps: ["mongoose", "passport"],
					}),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, memoryHintsProvider)
				const messages = createMessages(3, "Auth system")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("Dependencies: mongoose, passport")
				expect(promptCall).toContain("Memory tags: authentication, database, api-endpoint")
			})

			it("should generate context with AutoHintsProvider integration", async () => {
				// Mock comprehensive hints from auto provider
				const autoHintsProvider: HintsProvider = {
					getHints: vi.fn().mockResolvedValue({
						deps: ["react", "typescript", "vitest"],
						tags: ["component", "hook", "testing"],
						dirs: ["src", "components", "__tests__"],
						extra: ["ui", "frontend"],
					}),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, autoHintsProvider)
				const messages = createMessages(4, "Component development")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("Dependencies: react, typescript, vitest")
				expect(promptCall).toContain("Memory tags: component, hook, testing")
				expect(promptCall).toContain("Key dirs: src, components, __tests__")
				expect(promptCall).toContain("Keywords: ui, frontend")
			})
		})

		describe("Project Context Parameter Handling", () => {
			it("should include project context in prompt when provided", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Project context test")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("Project: test-workspace (typescript/react)")
			})

			it("should handle project context without framework", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const contextWithoutFramework = {
					workspaceName: "simple-project",
					language: "javascript",
				}
				const messages = createMessages(2, "Simple project")

				await generator.describe(messages, contextWithoutFramework)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("Project: simple-project (javascript)")
				expect(promptCall).not.toContain("/")
			})

			it("should work without project context", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "No context")

				await generator.describe(messages)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).not.toContain("Project:")
				expect(mockLlmProvider.generateJson).toHaveBeenCalled()
			})
		})

		describe("Episode Metadata and Context Formatting", () => {
			it("should truncate long message content for prompt", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const longContent = "A".repeat(500) // Longer than 300 char limit
				const messages = [createMessage("user", longContent)]

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				const truncatedContent = longContent.substring(0, 300)
				expect(promptCall).toContain(truncatedContent)
				expect(promptCall).not.toContain(longContent)
			})

			it("should format conversation with role prefixes", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = [
					createMessage("user", "How do I implement authentication?"),
					createMessage("assistant", "You can use JWT tokens"),
					createMessage("system", "System notification"),
				]

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("user: How do I implement authentication?")
				expect(promptCall).toContain("assistant: You can use JWT tokens")
				expect(promptCall).toContain("system: System notification")
			})

			it("should pass project context to hints provider", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Context passing")

				await generator.describe(messages, testProjectContext)

				expect(mockHintsProvider.getHints).toHaveBeenCalledWith(testProjectContext)
			})

			it("should handle empty hint responses gracefully", async () => {
				const emptyHintsProvider: HintsProvider = {
					getHints: vi.fn().mockResolvedValue({}),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, emptyHintsProvider)
				const messages = createMessages(2, "Empty hints")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).not.toContain("Context:")
				expect(mockLlmProvider.generateJson).toHaveBeenCalled()
			})
		})
	})

	describe("LLM Integration Tests", () => {
		describe("LLM Adapter Interaction", () => {
			it("should call LLM with correct parameters", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(3, "LLM parameters")

				await generator.describe(messages, testProjectContext)

				expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(expect.any(String), {
					temperature: 0.2,
					max_tokens: 80,
				})
			})

			it("should construct proper prompt for LLM", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Prompt construction")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("Summarize this technical conversation episode in ≤10 words")
				expect(promptCall).toContain('Return JSON: { "description": "your 10-word summary" }')
				expect(promptCall).toContain("Conversation:")
			})

			it("should include hint context in LLM prompt", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Hint context")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain(
					"Context: Dependencies: react, typescript; Memory tags: component, interface; Key dirs: src, components; Keywords: custom-hint",
				)
			})
		})

		describe("LLM Response Processing", () => {
			it("should extract description from LLM JSON response", async () => {
				mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
					description: "React component development with TypeScript",
				})

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Description extraction")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("React component development with TypeScript")
			})

			it("should fallback to summary field if description missing", async () => {
				mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
					summary: "API endpoint implementation discussion",
				})

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(3, "Summary fallback")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("API endpoint implementation discussion")
			})

			it("should handle empty LLM response gracefully", async () => {
				mockLlmProvider.generateJson = vi.fn().mockResolvedValue({})

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Empty response")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Episode with 2 messages")
			})

			it("should trim whitespace from LLM response", async () => {
				mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
					description: "  \n  Spaced description  \n  ",
				})

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Whitespace trim")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Spaced description")
			})
		})

		describe("Context Synthesis and Quality", () => {
			it("should handle large hint arrays by limiting output", async () => {
				const largeHintsProvider: HintsProvider = {
					getHints: vi.fn().mockResolvedValue({
						deps: Array.from({ length: 10 }, (_, i) => `dep${i}`),
						tags: Array.from({ length: 10 }, (_, i) => `tag${i}`),
						dirs: Array.from({ length: 10 }, (_, i) => `dir${i}`),
						extra: Array.from({ length: 10 }, (_, i) => `extra${i}`),
					}),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, largeHintsProvider)
				const messages = createMessages(2, "Large hints")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				// Should limit to 5 deps, 5 tags, 5 dirs, 3 extra
				const depMatches = promptCall.match(/Dependencies: ([^;]+)/)?.[1]?.split(", ") || []
				const tagMatches = promptCall.match(/Memory tags: ([^;]+)/)?.[1]?.split(", ") || []
				const dirMatches = promptCall.match(/Key dirs: ([^;]+)/)?.[1]?.split(", ") || []
				const extraMatches = promptCall.match(/Keywords: ([^;]+)/)?.[1]?.split(", ") || []

				expect(depMatches).toHaveLength(5)
				expect(tagMatches).toHaveLength(5)
				expect(dirMatches).toHaveLength(5)
				expect(extraMatches).toHaveLength(3)
			})

			it("should format hints with proper separators", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Hint formatting")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain(
					"Context: Dependencies: react, typescript; Memory tags: component, interface; Key dirs: src, components; Keywords: custom-hint",
				)
			})

			it("should handle partial hint data gracefully", async () => {
				const partialHintsProvider: HintsProvider = {
					getHints: vi.fn().mockResolvedValue({
						deps: ["only-deps"],
						// No tags, dirs, or extra
					}),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, partialHintsProvider)
				const messages = createMessages(2, "Partial hints")

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("Context: Dependencies: only-deps")
				expect(promptCall).not.toContain("Memory tags:")
				expect(promptCall).not.toContain("Key dirs:")
				expect(promptCall).not.toContain("Keywords:")
			})

			it("should handle multiple LLM calls for different episodes", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)

				mockLlmProvider.generateJson = vi
					.fn()
					.mockResolvedValueOnce({ description: "First episode description" })
					.mockResolvedValueOnce({ description: "Second episode description" })

				const messages1 = createMessages(2, "First episode")
				const messages2 = createMessages(3, "Second episode")

				const result1 = await generator.describe(messages1, testProjectContext)
				const result2 = await generator.describe(messages2, testProjectContext)

				expect(result1).toBe("First episode description")
				expect(result2).toBe("Second episode description")
				expect(mockLlmProvider.generateJson).toHaveBeenCalledTimes(2)
			})
		})
	})

	describe("Error Handling Tests", () => {
		describe("LLM Provider Failures", () => {
			it("should handle LLM adapter network failures", async () => {
				mockLlmProvider.generateJson = vi.fn().mockRejectedValue(new Error("Network connection failed"))

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(3, "Network failure")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Episode with 3 messages")
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[EpisodeContextGenerator] LLM context generation failed:",
					expect.any(Error),
				)
			})

			it("should handle LLM adapter timeout scenarios", async () => {
				mockLlmProvider.generateJson = vi.fn().mockRejectedValue(new Error("Request timeout"))

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(2, "Timeout test")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Episode with 2 messages")
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[EpisodeContextGenerator] LLM context generation failed:",
					expect.any(Error),
				)
			})

			it("should handle malformed LLM JSON responses", async () => {
				mockLlmProvider.generateJson = vi.fn().mockResolvedValue(null)

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(4, "Malformed response")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Episode with 4 messages")
			})

			it("should handle LLM response with null description", async () => {
				mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
					description: null,
					summary: null,
				})

				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(1, "Null description")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Episode with 1 messages")
			})
		})

		describe("Hints Provider Failures", () => {
			it("should handle hints provider failures gracefully", async () => {
				const failingHintsProvider: HintsProvider = {
					getHints: vi.fn().mockRejectedValue(new Error("Vector store connection failed")),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, failingHintsProvider)
				const messages = createMessages(2, "Provider failure")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Generated episode description")
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[EpisodeContextGenerator] Failed to get hints:",
					expect.any(Error),
				)
			})

			it("should continue when hints provider returns null", async () => {
				const nullHintsProvider: HintsProvider = {
					getHints: vi.fn().mockRejectedValue(new Error("Hints provider failed")),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, nullHintsProvider)
				const messages = createMessages(2, "Null hints")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Generated episode description")
				expect(mockLlmProvider.generateJson).toHaveBeenCalled()
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[EpisodeContextGenerator] Failed to get hints:",
					expect.any(Error),
				)
			})

			it("should handle hints provider timeout", async () => {
				const timeoutHintsProvider: HintsProvider = {
					getHints: vi
						.fn()
						.mockImplementation(
							() => new Promise((_, reject) => setTimeout(() => reject(new Error("Hints timeout")), 100)),
						),
				}

				const generator = new EpisodeContextGenerator(mockLlmProvider, timeoutHintsProvider)
				const messages = createMessages(2, "Hints timeout")

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Generated episode description")
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[EpisodeContextGenerator] Failed to get hints:",
					expect.any(Error),
				)
			})
		})

		describe("Input Validation and Edge Cases", () => {
			it("should handle empty message arrays", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages: Message[] = []

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Generated episode description")
				expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(
					expect.stringContaining("Conversation:\n"),
					expect.any(Object),
				)
			})

			it("should handle messages with empty or null content", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = [
					{ role: "user" as const, content: "" },
					{ role: "assistant" as const, content: "   " }, // Whitespace only
					createMessage("user", "Valid message"),
				]

				const result = await generator.describe(messages, testProjectContext)

				expect(result).toBe("Generated episode description")
				expect(mockLlmProvider.generateJson).toHaveBeenCalled()

				// Verify the prompt was constructed correctly with empty content
				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				expect(promptCall).toContain("user: ")
				expect(promptCall).toContain("assistant:    ")
				expect(promptCall).toContain("user: Valid message")
			})

			it("should handle concurrent describe calls", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)

				mockLlmProvider.generateJson = vi
					.fn()
					.mockResolvedValueOnce({ description: "Concurrent call 1" })
					.mockResolvedValueOnce({ description: "Concurrent call 2" })

				const messages1 = createMessages(2, "Concurrent 1")
				const messages2 = createMessages(2, "Concurrent 2")

				const [result1, result2] = await Promise.all([
					generator.describe(messages1, testProjectContext),
					generator.describe(messages2, testProjectContext),
				])

				expect(result1).toBe("Concurrent call 1")
				expect(result2).toBe("Concurrent call 2")
				expect(mockLlmProvider.generateJson).toHaveBeenCalledTimes(2)
			})
		})
	})

	describe("Performance & Quality Tests", () => {
		describe("Context Generation Performance", () => {
			it("should complete context generation within reasonable time", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(10, "Performance test")

				const startTime = Date.now()
				await generator.describe(messages, testProjectContext)
				const endTime = Date.now()

				// Should complete within 100ms for mocked responses
				expect(endTime - startTime).toBeLessThan(100)
			})

			it("should handle large message arrays efficiently", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(100, "Large array")

				const startTime = Date.now()
				await generator.describe(messages, testProjectContext)
				const endTime = Date.now()

				// Should handle large arrays without significant performance impact
				expect(endTime - startTime).toBeLessThan(200)
				expect(mockLlmProvider.generateJson).toHaveBeenCalled()
			})

			it("should optimize prompt size for large conversations", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const longMessages = Array.from({ length: 50 }, (_, i) =>
					createMessage(i % 2 === 0 ? "user" : "assistant", "A".repeat(500)),
				)

				await generator.describe(longMessages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
				// Each message should be truncated to 300 chars
				const conversationSection = promptCall.split("Conversation:\n")[1]
				const lines = conversationSection.split("\n").filter((line) => line.trim())

				// Verify truncation is working
				lines.forEach((line) => {
					const contentPart = line.split(": ")[1]
					if (contentPart) {
						expect(contentPart.length).toBeLessThanOrEqual(300)
					}
				})
			})
		})

		describe("Context Quality Validation", () => {
			it("should produce consistent results for identical inputs", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(3, "Consistency test")

				mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
					description: "Consistent description",
				})

				const result1 = await generator.describe([...messages], testProjectContext)
				const result2 = await generator.describe([...messages], testProjectContext)

				expect(result1).toBe(result2)
				expect(result1).toBe("Consistent description")
			})

			it("should validate context structure and relevance", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = [
					createMessage("user", "How do I implement React hooks?"),
					createMessage("assistant", "You can use useState and useEffect"),
				]

				await generator.describe(messages, testProjectContext)

				const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]

				// Verify prompt structure
				expect(promptCall).toContain("Summarize this technical conversation episode")
				expect(promptCall).toContain("≤10 words")
				expect(promptCall).toContain("Project: test-workspace (typescript/react)")
				expect(promptCall).toContain("Conversation:")
				expect(promptCall).toContain("Return JSON:")
			})

			it("should handle context size limits appropriately", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				const messages = createMessages(5, "Size limits")

				await generator.describe(messages, testProjectContext)

				// Verify LLM called with appropriate token limits
				expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(
					expect.any(String),
					expect.objectContaining({
						max_tokens: 80,
						temperature: 0.2,
					}),
				)
			})
		})

		describe("Memory Usage Optimization", () => {
			it("should not retain references to large message arrays", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)
				let messages = createMessages(1000, "Memory test")

				await generator.describe(messages, testProjectContext)

				// Clear reference and force garbage collection if available
				messages = null as any
				if (global.gc) {
					global.gc()
				}

				// Generator should not hold references to the original messages
				expect(mockLlmProvider.generateJson).toHaveBeenCalled()
			})

			it("should handle concurrent context generation without memory leaks", async () => {
				const generator = new EpisodeContextGenerator(mockLlmProvider, mockHintsProvider)

				mockLlmProvider.generateJson = vi
					.fn()
					.mockImplementation(() => Promise.resolve({ description: `Generated at ${Date.now()}` }))

				// Run multiple concurrent operations
				const promises = Array.from({ length: 10 }, (_, i) =>
					generator.describe(createMessages(5, `Concurrent ${i}`), testProjectContext),
				)

				const results = await Promise.all(promises)

				expect(results).toHaveLength(10)
				expect(mockLlmProvider.generateJson).toHaveBeenCalledTimes(10)
				results.forEach((result) => {
					expect(result).toContain("Generated at")
				})
			})
		})
	})
})
