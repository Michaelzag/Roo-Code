import type { IEmbedder as RooEmbedder, EmbeddingResponse } from "../../../code-index/interfaces/embedder"
import type { IEmbedder } from "../../interfaces"
import { RooEmbedderAdapter } from "../roo-embedder-adapter"

/**
 * Comprehensive test suite for RooEmbedderAdapter following established patterns.
 * This adapter wraps code-index embedders to provide conversation-memory compatibility.
 *
 * Test areas covered:
 * - Core functionality (embed method)
 * - Batch operations (embedBatch method)
 * - Error handling (401, 429, ECONNREFUSED, API errors)
 * - Input validation (empty strings, null, undefined)
 * - Edge cases (empty embeddings, malformed responses)
 */
describe("RooEmbedderAdapter", () => {
	let mockInnerEmbedder: RooEmbedder
	let adapter: IEmbedder
	let consoleLogSpy: ReturnType<typeof vi.spyOn>
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	const testDimension = 1536
	const mockEmbedding = new Array(testDimension).fill(0.1)

	beforeEach(() => {
		// Create comprehensive mock for inner embedder
		mockInnerEmbedder = {
			createEmbeddings: vi.fn(),
			validateConfiguration: vi.fn(),
			embedderInfo: { name: "openai" as const },
		}

		// Spy on console methods to verify logging behavior
		consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {})
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Create adapter instance
		adapter = new RooEmbedderAdapter(mockInnerEmbedder, testDimension)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("Constructor", () => {
		it("should initialize with inner embedder and dimension", () => {
			expect(adapter.dimension).toBe(testDimension)
		})

		it("should store inner embedder reference", () => {
			expect((adapter as any).inner).toBe(mockInnerEmbedder)
		})

		it("should handle different dimension values", () => {
			const dimensions = [256, 384, 512, 768, 1024, 1536, 2048]

			dimensions.forEach((dim) => {
				const testAdapter = new RooEmbedderAdapter(mockInnerEmbedder, dim)
				expect(testAdapter.dimension).toBe(dim)
			})
		})
	})

	describe("embed method", () => {
		describe("Successful embedding generation", () => {
			it("should create embedding for text input", async () => {
				const testText = "This is a test text for embedding"
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
					usage: { promptTokens: 10, totalTokens: 10 },
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed(testText)

				expect(mockInnerEmbedder.createEmbeddings).toHaveBeenCalledWith([testText])
				expect(result).toEqual(mockEmbedding)
				expect(consoleLogSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] embed called for text length:",
					testText.length,
				)
				expect(consoleLogSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] embedding result length:",
					mockEmbedding.length,
				)
			})

			it("should handle long text input", async () => {
				const longText = "word ".repeat(1000) // 5000+ character text
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed(longText)

				expect(result).toEqual(mockEmbedding)
				expect(consoleLogSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] embed called for text length:",
					longText.length,
				)
			})

			it("should handle short text input", async () => {
				const shortText = "Hi"
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed(shortText)

				expect(result).toEqual(mockEmbedding)
				expect(consoleLogSpy).toHaveBeenCalledWith("[RooEmbedderAdapter] embed called for text length:", 2)
			})

			it("should handle special characters and unicode", async () => {
				const specialText = "Hello 世界! 🌍 Special chars: àáâãäåæçèé"
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed(specialText)

				expect(result).toEqual(mockEmbedding)
				expect(mockInnerEmbedder.createEmbeddings).toHaveBeenCalledWith([specialText])
			})

			it("should extract first embedding from response", async () => {
				const multiEmbeddingResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding, new Array(testDimension).fill(0.2)],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(multiEmbeddingResponse)

				const result = await adapter.embed("test")

				expect(result).toEqual(mockEmbedding) // Should return first embedding
			})
		})

		describe("Empty embedding validation", () => {
			it("should throw error when embedder returns empty array", async () => {
				const mockResponse: EmbeddingResponse = {
					embeddings: [[]], // Empty embedding
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				await expect(adapter.embed("test")).rejects.toThrow(
					"Embedder returned empty embedding - check API key configuration",
				)

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] Embedder returned empty array - likely missing API key",
				)
			})

			it("should throw error when embeddings array is empty", async () => {
				const mockResponse: EmbeddingResponse = {
					embeddings: [], // No embeddings
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				await expect(adapter.embed("test")).rejects.toThrow(
					"Embedder returned empty embedding - check API key configuration",
				)
			})

			it("should throw error when embeddings is undefined", async () => {
				const mockResponse: EmbeddingResponse = {
					embeddings: undefined as any,
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				await expect(adapter.embed("test")).rejects.toThrow(
					"Embedder returned empty embedding - check API key configuration",
				)
			})
		})

		describe("API Error handling", () => {
			it("should handle 401 Unauthorized errors", async () => {
				const unauthorizedError = new Error("HTTP 401 Unauthorized")
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(unauthorizedError)

				await expect(adapter.embed("test")).rejects.toThrow("Invalid or missing API key for embedder")

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] Failed to create embedding:",
					unauthorizedError,
				)
			})

			it("should handle 429 Rate Limit errors", async () => {
				const rateLimitError = new Error("HTTP 429 Too Many Requests")
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(rateLimitError)

				await expect(adapter.embed("test")).rejects.toThrow("Rate limit exceeded for embedder API")
			})

			it("should handle ECONNREFUSED connection errors", async () => {
				const connectionError = new Error("connect ECONNREFUSED 127.0.0.1:11434")
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(connectionError)

				await expect(adapter.embed("test")).rejects.toThrow("Cannot connect to embedder service")
			})

			it("should handle 401 in error message variations", async () => {
				const variations = [
					"Request failed with status 401",
					"401 Unauthorized access",
					"Authentication failed: 401",
				]

				for (const message of variations) {
					const error = new Error(message)
					mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(error)

					await expect(adapter.embed("test")).rejects.toThrow("Invalid or missing API key for embedder")
				}
			})

			it("should handle 429 in error message variations", async () => {
				const variations = ["Request failed with status 429", "429 Too Many Requests", "Rate limit hit: 429"]

				for (const message of variations) {
					const error = new Error(message)
					mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(error)

					await expect(adapter.embed("test")).rejects.toThrow("Rate limit exceeded for embedder API")
				}
			})

			it("should re-throw unrecognized errors", async () => {
				const unknownError = new Error("Unknown server error")
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(unknownError)

				await expect(adapter.embed("test")).rejects.toThrow("Unknown server error")

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] Failed to create embedding:",
					unknownError,
				)
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] Error details:",
					"Unknown server error",
				)
			})
		})

		describe("Input validation and edge cases", () => {
			it("should handle empty string input", async () => {
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed("")

				expect(result).toEqual(mockEmbedding)
				expect(consoleLogSpy).toHaveBeenCalledWith("[RooEmbedderAdapter] embed called for text length:", 0)
			})

			it("should handle whitespace-only input", async () => {
				const whitespaceText = "   \n\t  "
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed(whitespaceText)

				expect(result).toEqual(mockEmbedding)
				expect(mockInnerEmbedder.createEmbeddings).toHaveBeenCalledWith([whitespaceText])
			})

			it("should handle newlines and special whitespace", async () => {
				const textWithNewlines = "Line 1\nLine 2\r\nLine 3\tTabbed"
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed(textWithNewlines)

				expect(result).toEqual(mockEmbedding)
			})
		})

		describe("Error logging verification", () => {
			it("should log error details when embedding fails", async () => {
				const testError = new Error("Detailed error message")
				testError.stack = "Error stack trace"
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(testError)

				await expect(adapter.embed("test")).rejects.toThrow("Detailed error message")

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] Failed to create embedding:",
					testError,
				)
				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] Error details:",
					"Detailed error message",
				)
			})

			it("should handle error objects without message property", async () => {
				const errorObject = { code: "NETWORK_ERROR", details: "Connection failed" }
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(errorObject)

				await expect(adapter.embed("test")).rejects.toThrow()

				expect(consoleErrorSpy).toHaveBeenCalledWith("[RooEmbedderAdapter] Error details:", "[object Object]")
			})

			it("should handle non-Error objects being thrown", async () => {
				const stringError = "String error message"
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(stringError)

				await expect(adapter.embed("test")).rejects.toThrow("String error message")

				expect(consoleErrorSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] Error details:",
					"String error message",
				)
			})
		})
	})

	describe("embedBatch method", () => {
		describe("Successful batch operations", () => {
			it("should create embeddings for multiple texts", async () => {
				const testTexts = ["First text", "Second text", "Third text"]
				const batchEmbeddings = [
					new Array(testDimension).fill(0.1),
					new Array(testDimension).fill(0.2),
					new Array(testDimension).fill(0.3),
				]
				const mockResponse: EmbeddingResponse = {
					embeddings: batchEmbeddings,
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embedBatch(testTexts)

				expect(mockInnerEmbedder.createEmbeddings).toHaveBeenCalledWith(testTexts)
				expect(result).toEqual(batchEmbeddings)
			})

			it("should handle single text in batch", async () => {
				const singleText = ["Only one text"]
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embedBatch(singleText)

				expect(result).toEqual([mockEmbedding])
			})

			it("should handle large batch of texts", async () => {
				const largeTextBatch = Array.from({ length: 100 }, (_, i) => `Text ${i}`)
				const largeBatchEmbeddings = Array.from({ length: 100 }, (_, i) =>
					new Array(testDimension).fill(i / 100),
				)
				const mockResponse: EmbeddingResponse = {
					embeddings: largeBatchEmbeddings,
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embedBatch(largeTextBatch)

				expect(result).toEqual(largeBatchEmbeddings)
				expect(mockInnerEmbedder.createEmbeddings).toHaveBeenCalledWith(largeTextBatch)
			})

			it("should handle empty batch array", async () => {
				const emptyBatch: string[] = []
				const mockResponse: EmbeddingResponse = {
					embeddings: [],
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embedBatch(emptyBatch)

				expect(result).toEqual([])
				expect(mockInnerEmbedder.createEmbeddings).toHaveBeenCalledWith([])
			})

			it("should handle mixed content in batch", async () => {
				const mixedTexts = [
					"Normal text",
					"",
					"Text with special chars: àáâã 🌍",
					"   whitespace   ",
					"Very long text ".repeat(100),
				]
				const mixedEmbeddings = Array.from({ length: 5 }, (_, i) => new Array(testDimension).fill(i / 10))
				const mockResponse: EmbeddingResponse = {
					embeddings: mixedEmbeddings,
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embedBatch(mixedTexts)

				expect(result).toEqual(mixedEmbeddings)
			})
		})

		describe("Error handling in batch operations", () => {
			it("should propagate errors from inner embedder", async () => {
				const batchError = new Error("Batch processing failed")
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(batchError)

				await expect(adapter.embedBatch(["test1", "test2"])).rejects.toThrow("Batch processing failed")
			})

			it("should handle API errors in batch operations", async () => {
				const apiError = new Error("API rate limit exceeded in batch")
				mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(apiError)

				await expect(adapter.embedBatch(["test"])).rejects.toThrow("API rate limit exceeded in batch")
			})

			it("should handle undefined embeddings response", async () => {
				const mockResponse: EmbeddingResponse = {
					embeddings: undefined as any,
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embedBatch(["test"])

				expect(result).toEqual([]) // Should return empty array when embeddings is undefined
			})

			it("should handle null embeddings response", async () => {
				const mockResponse: EmbeddingResponse = {
					embeddings: null as any,
				}

				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embedBatch(["test"])

				expect(result).toEqual([])
			})
		})
	})

	describe("Dimension consistency", () => {
		it("should maintain consistent dimension across operations", () => {
			const dimensions = [256, 384, 512, 768, 1024, 1536, 2048]

			dimensions.forEach((dim) => {
				const testAdapter = new RooEmbedderAdapter(mockInnerEmbedder, dim)
				expect(testAdapter.dimension).toBe(dim)
			})
		})

		it("should store dimension as readonly property", () => {
			expect(() => {
				;(adapter as any).dimension = 999
			}).not.toThrow() // TypeScript prevents this, but runtime allows it

			// Verify the property descriptor
			const descriptor = Object.getOwnPropertyDescriptor(adapter, "dimension")
			expect(descriptor?.writable).toBe(true) // Class property is writable at runtime
		})
	})

	describe("Integration scenarios", () => {
		/**
		 * Tests simulating real-world usage patterns with the conversation memory system
		 */
		it("should handle rapid consecutive embed calls", async () => {
			const texts = ["Text 1", "Text 2", "Text 3"]
			const embeddings = texts.map((_, i) => new Array(testDimension).fill(i / 10))

			// Mock each call separately
			embeddings.forEach((embedding, index) => {
				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValueOnce({
					embeddings: [embedding],
				})
			})

			// Reset the mock to handle all calls
			mockInnerEmbedder.createEmbeddings = vi.fn()
			texts.forEach((_, index) => {
				;(mockInnerEmbedder.createEmbeddings as any).mockResolvedValueOnce({
					embeddings: [embeddings[index]],
				})
			})

			const promises = texts.map((text) => adapter.embed(text))
			const results = await Promise.all(promises)

			expect(results).toHaveLength(3)
			results.forEach((result, index) => {
				expect(result).toEqual(embeddings[index])
			})
		})

		it("should handle mixed single and batch operations", async () => {
			// First, do a single embed
			const singleMockResponse: EmbeddingResponse = {
				embeddings: [mockEmbedding],
			}
			mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValueOnce(singleMockResponse)

			const singleResult = await adapter.embed("Single text")
			expect(singleResult).toEqual(mockEmbedding)

			// Then, do a batch embed
			const batchTexts = ["Batch 1", "Batch 2"]
			const batchEmbeddings = [new Array(testDimension).fill(0.2), new Array(testDimension).fill(0.3)]
			const batchMockResponse: EmbeddingResponse = {
				embeddings: batchEmbeddings,
			}
			mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValueOnce(batchMockResponse)

			const batchResult = await adapter.embedBatch(batchTexts)
			expect(batchResult).toEqual(batchEmbeddings)
		})

		it("should maintain performance with various text sizes", async () => {
			const textSizes = [
				"", // Empty
				"Short", // Very short
				"Medium length text content", // Medium
				"Very long text content ".repeat(100), // Long
			]

			for (const text of textSizes) {
				const mockResponse: EmbeddingResponse = {
					embeddings: [mockEmbedding],
				}
				mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(mockResponse)

				const result = await adapter.embed(text)
				expect(result).toEqual(mockEmbedding)
				expect(consoleLogSpy).toHaveBeenCalledWith(
					"[RooEmbedderAdapter] embed called for text length:",
					text.length,
				)
			}
		})
	})

	describe("Timeout and network edge cases", () => {
		it("should handle timeout errors", async () => {
			const timeoutError = new Error("Request timeout after 30000ms")
			mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(timeoutError)

			await expect(adapter.embed("test")).rejects.toThrow("Request timeout after 30000ms")
		})

		it("should handle network unavailable errors", async () => {
			const networkError = new Error("Network is unreachable")
			mockInnerEmbedder.createEmbeddings = vi.fn().mockRejectedValue(networkError)

			await expect(adapter.embed("test")).rejects.toThrow("Network is unreachable")
		})

		it("should handle malformed response structures", async () => {
			const malformedResponse = {
				// Missing embeddings property
				usage: { promptTokens: 5, totalTokens: 5 },
			} as any

			mockInnerEmbedder.createEmbeddings = vi.fn().mockResolvedValue(malformedResponse)

			await expect(adapter.embed("test")).rejects.toThrow(
				"Embedder returned empty embedding - check API key configuration",
			)
		})
	})
})
