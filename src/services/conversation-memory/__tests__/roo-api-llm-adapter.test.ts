import { describe, it, expect, vi, beforeEach } from "vitest"
import { RooApiLlmProviderAdapter } from "../adapters/roo-api-llm-adapter"
import type { ApiHandler } from "../../../api"

/**
 * Tests for the RooApiLlmProviderAdapter that integrates conversation memory
 * with Roo-Code's ApiHandler system, ensuring the same model is used for
 * memory extraction as for agent responses.
 */
describe("RooApiLlmProviderAdapter", () => {
	let adapter: RooApiLlmProviderAdapter
	let mockApiHandler: ApiHandler
	let mockStream: AsyncIterableIterator<any>

	beforeEach(() => {
		// Create mock stream iterator
		mockStream = {
			async *[Symbol.asyncIterator]() {
				yield { type: "text", text: "mock response" }
			},
			next: vi.fn(),
			return: vi.fn(),
			throw: vi.fn(),
			[Symbol.asyncDispose]: async () => {},
		} as any

		mockApiHandler = {
			createMessage: vi.fn().mockReturnValue(mockStream),
		} as any

		adapter = new RooApiLlmProviderAdapter(mockApiHandler)
	})

	describe("generateJson", () => {
		it("should generate JSON using ApiHandler with correct system message", async () => {
			const mockJsonResponse = '{"facts": [{"content": "test", "category": "pattern"}]}'
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: mockJsonResponse }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(mockApiHandler.createMessage).toHaveBeenCalledWith(
				expect.stringContaining("You are a JSON-only function"),
				[{ role: "user", content: "test prompt" }],
			)
			expect(result).toEqual({ facts: [{ content: "test", category: "pattern" }] })
		})

		it("should handle stream with multiple text chunks", async () => {
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: '{"facts": [' }
					yield { type: "text", text: '{"content": "test"}' }
					yield { type: "text", text: "]}" }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({ facts: [{ content: "test" }] })
		})

		it("should handle stream with non-text chunks", async () => {
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "usage", tokens: 100 } // Non-text chunk
					yield { type: "text", text: '{"result": "success"}' }
					yield { type: "error", message: "ignored" } // Non-text chunk
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({ result: "success" })
		})

		it("should remove markdown JSON fences", async () => {
			const responses = [
				'```json\n{"test": true}\n```',
				'```\n{"test": true}\n```',
				'```JSON\n{"test": true}\n```', // Case insensitive
				'{"test": true}', // No fences
			]

			for (const response of responses) {
				mockStream = {
					async *[Symbol.asyncIterator]() {
						yield { type: "text", text: response }
					},
					next: vi.fn(),
					return: vi.fn(),
					throw: vi.fn(),
				}
				vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

				const result = await adapter.generateJson("test prompt")
				expect(result).toEqual({ test: true })
			}
		})

		it("should handle malformed JSON with fallback parsing", async () => {
			const malformedJson = 'Some text before {"valid": "json"} and after'
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: malformedJson }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({ valid: "json" })
		})

		it("should handle nested JSON objects in fallback parsing", async () => {
			const complexJson = 'Text before {"outer": {"inner": "value", "array": [1, 2, 3]}} after'
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: complexJson }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({
				outer: {
					inner: "value",
					array: [1, 2, 3],
				},
			})
		})

		it("should return empty object when no valid JSON found", async () => {
			const noJsonResponse = "This response contains no valid JSON at all"
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: noJsonResponse }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({})
		})

		it("should return empty object when JSON parsing completely fails", async () => {
			const invalidJson = '{"invalid": json, "missing": quotes}'
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: invalidJson }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({})
		})

		it("should handle empty stream response", async () => {
			mockStream = {
				async *[Symbol.asyncIterator]() {
					// Empty stream
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({})
		})

		it("should handle stream with only whitespace", async () => {
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: "   \n\t  " }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			expect(result).toEqual({})
		})

		it("should handle stream errors gracefully", async () => {
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: '{"partial":' }
					throw new Error("Stream error")
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			// Stream errors propagate - implementation doesn't catch them
			await expect(adapter.generateJson("test prompt")).rejects.toThrow("Stream error")
		})

		it("should preserve options parameter interface", async () => {
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: '{"success": true}' }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt", {
				temperature: 0.1,
				max_tokens: 1000,
			})

			expect(result).toEqual({ success: true })
			// Options are ignored for now but should not cause errors
		})

		it("should handle complex fact extraction JSON structure", async () => {
			const factsJson = {
				facts: [
					{
						content: "Using React with TypeScript for frontend",
						category: "infrastructure",
						confidence: 0.95,
					},
					{
						content: "Authentication implemented with JWT tokens",
						category: "architecture",
						confidence: 0.88,
					},
					{
						content: "Fixed memory leak in component cleanup",
						category: "pattern",
						confidence: 0.92,
					},
				],
			}

			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: JSON.stringify(factsJson) }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("extract facts from conversation")

			expect(result).toEqual(factsJson)
			expect(result.facts).toHaveLength(3)
			expect(result.facts[0].category).toBe("infrastructure")
		})

		it("should handle multiple JSON objects and fall back to empty object", async () => {
			const multipleJson = '{"first": "object"} {"second": "object"}'
			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: multipleJson }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson("test prompt")

			// Multiple JSON objects can't be parsed as single JSON, falls back to extraction
			// The fallback tries to find first { to last } but this fails with multiple objects
			expect(result).toEqual({})
		})
	})

	describe("integration with conversation memory", () => {
		it("should work with typical fact extraction scenario", async () => {
			const conversationPrompt = `You are organizing technical facts for a typescript project.
Project: test-app
Framework: express

Categories:
- infrastructure — core tech stack, DB, deployment (persistent)
- architecture — design decisions and approaches (can be superseded)
- debugging — current problems/issues (temporary; resolve → promote)
- pattern — solutions & lessons learned (persistent wisdom)

CONVERSATION:
USER: How should I implement authentication?
ASSISTANT: I recommend using JWT tokens with proper secret management.

Return JSON: { "facts": [...] }`

			const expectedResponse = {
				facts: [
					{
						content: "JWT tokens recommended for authentication implementation",
						category: "architecture",
						confidence: 0.85,
					},
					{
						content: "Proper secret management required for JWT implementation",
						category: "pattern",
						confidence: 0.9,
					},
				],
			}

			mockStream = {
				async *[Symbol.asyncIterator]() {
					yield { type: "text", text: JSON.stringify(expectedResponse) }
				},
				next: vi.fn(),
				return: vi.fn(),
				throw: vi.fn(),
				[Symbol.asyncDispose]: async () => {},
			} as any
			vi.mocked(mockApiHandler.createMessage).mockReturnValue(mockStream as any)

			const result = await adapter.generateJson(conversationPrompt)

			expect(result.facts).toHaveLength(2)
			expect(result.facts[0].category).toBe("architecture")
			expect(result.facts[1].category).toBe("pattern")
			expect(mockApiHandler.createMessage).toHaveBeenCalledWith(expect.stringContaining("JSON-only function"), [
				{ role: "user", content: conversationPrompt },
			])
		})
	})
})
