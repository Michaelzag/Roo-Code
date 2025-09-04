import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import { QdrantMemoryStore } from "../storage/qdrant-memory-store"
import { createQdrantClientFromUrl, ensureCollection } from "../../qdrant/common"

// Mocks following established pattern
vi.mock("@qdrant/js-client-rest")
vi.mock("crypto")
vi.mock("../../qdrant/common")

const mockQdrantClientInstance = {
	getCollection: vi.fn(),
	createCollection: vi.fn(),
	deleteCollection: vi.fn(),
	createPayloadIndex: vi.fn(),
	upsert: vi.fn(),
	query: vi.fn(),
	delete: vi.fn(),
	retrieve: vi.fn(),
	setPayload: vi.fn(),
	updateVectors: vi.fn(),
	scroll: vi.fn(),
}

const mockCreateHashInstance = {
	update: vi.fn().mockReturnThis(),
	digest: vi.fn(),
}

/**
 * Tests for QdrantMemoryStore following established patterns from code-index/qdrant-client.spec.ts
 * Maintains parity with comprehensive Qdrant testing approach
 */
describe("QdrantMemoryStore", () => {
	let memoryStore: QdrantMemoryStore
	const mockWorkspacePath = "/test/workspace"
	const mockQdrantUrl = "http://localhost:6333"
	const mockApiKey = "test-api-key"
	const mockDimension = 1536
	const mockHashedPath = "a1b2c3d4e5f67890123456789abcdef0" // Valid hex hash
	const expectedCollectionName = `ws-${mockHashedPath.substring(0, 16)}-memory`

	beforeEach(() => {
		vi.clearAllMocks()

		// Mock createQdrantClientFromUrl
		vi.mocked(createQdrantClientFromUrl).mockReturnValue(mockQdrantClientInstance as any)

		// Mock crypto.createHash
		vi.mocked(createHash).mockReturnValue(mockCreateHashInstance as any)
		mockCreateHashInstance.update.mockReturnValue(mockCreateHashInstance)
		mockCreateHashInstance.digest.mockReturnValue(mockHashedPath)

		// Mock ensureCollection
		vi.mocked(ensureCollection).mockResolvedValue(true)

		memoryStore = new QdrantMemoryStore(mockWorkspacePath, mockQdrantUrl, mockDimension, mockApiKey)
	})

	describe("Constructor and Initialization", () => {
		it("should correctly initialize with workspace-specific collection name", () => {
			expect(createQdrantClientFromUrl).toHaveBeenCalledWith(mockQdrantUrl, mockApiKey)
			expect(createHash).toHaveBeenCalledWith("sha256")
			expect(mockCreateHashInstance.update).toHaveBeenCalledWith(mockWorkspacePath)
			expect(mockCreateHashInstance.digest).toHaveBeenCalledWith("hex")
			expect(memoryStore.collectionName()).toBe(expectedCollectionName)
		})

		it("should handle constructor without API key", () => {
			const storeWithoutKey = new QdrantMemoryStore(mockWorkspacePath, mockQdrantUrl, mockDimension)

			expect(createQdrantClientFromUrl).toHaveBeenLastCalledWith(mockQdrantUrl, undefined)
			expect(storeWithoutKey.collectionName()).toBe(expectedCollectionName)
		})

		it("should generate different collection names for different workspaces", () => {
			const workspace2Hash = "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7"
			mockCreateHashInstance.digest.mockReturnValueOnce(workspace2Hash)

			const store2 = new QdrantMemoryStore("/different/workspace", mockQdrantUrl, mockDimension)

			expect(store2.collectionName()).toBe(`ws-${workspace2Hash.substring(0, 16)}-memory`)
			expect(store2.collectionName()).not.toBe(expectedCollectionName)
		})
	})

	describe("Collection Management", () => {
		it("should ensure collection with proper configuration", async () => {
			const customName = "custom-memory-collection"
			const customDimension = 768

			await memoryStore.ensureCollection(customName, customDimension)

			expect(ensureCollection).toHaveBeenCalledWith(mockQdrantClientInstance, customName, customDimension, {
				distance: "Cosine",
				onDisk: true,
				hnsw: { m: 64, ef_construct: 512, on_disk: true },
			})

			// Should update internal collection name
			expect(memoryStore.collectionName()).toBe(customName)
		})
	})

	describe("Vector Operations", () => {
		describe("upsert", () => {
			it("should upsert records correctly", async () => {
				const testRecords = [
					{
						id: "fact-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Test fact", category: "architecture" },
					},
					{
						id: "fact-2",
						vector: [0.4, 0.5, 0.6],
						payload: { content: "Another fact", category: "infrastructure" },
					},
				]

				await memoryStore.upsert(testRecords)

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: testRecords,
				})
			})

			it("should handle empty records array", async () => {
				await memoryStore.upsert([])

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, { points: [] })
			})
		})

		describe("insert", () => {
			it("should insert vectors with proper point structure", async () => {
				const vectors = [
					[0.1, 0.2, 0.3],
					[0.4, 0.5, 0.6],
				]
				const ids = ["id-1", "id-2"]
				const payloads = [
					{ content: "First fact", category: "pattern" },
					{ content: "Second fact", category: "debugging" },
				]

				await memoryStore.insert(vectors, ids, payloads)

				const expectedPoints = [
					{ id: "id-1", vector: [0.1, 0.2, 0.3], payload: payloads[0] },
					{ id: "id-2", vector: [0.4, 0.5, 0.6], payload: payloads[1] },
				]

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: expectedPoints,
				})
			})

			it("should handle mismatched array lengths by processing all IDs", async () => {
				const vectors = [[0.1, 0.2]]
				const ids = ["id-1", "id-2"] // More IDs than vectors
				const payloads = [{ content: "fact" }]

				await memoryStore.insert(vectors, ids, payloads)

				// Implementation processes all IDs, using undefined for missing data
				const expectedPoints = [
					{ id: "id-1", vector: [0.1, 0.2], payload: { content: "fact" } },
					{ id: "id-2", vector: undefined, payload: undefined },
				]

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: expectedPoints,
				})
			})
		})

		describe("update", () => {
			it("should update payload and vector when both provided", async () => {
				const testId = "fact-123"
				const newVector = [0.7, 0.8, 0.9]
				const newPayload = { content: "Updated fact", category: "architecture" }

				await memoryStore.update(testId, newVector, newPayload)

				expect(mockQdrantClientInstance.setPayload).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
					payload: newPayload,
				})

				expect(mockQdrantClientInstance.updateVectors).toHaveBeenCalledWith(expectedCollectionName, {
					points: [{ id: testId, vector: newVector }],
				})
			})

			it("should update only payload when vector is null", async () => {
				const testId = "fact-456"
				const newPayload = { content: "Payload only update", resolved: true }

				await memoryStore.update(testId, null, newPayload)

				expect(mockQdrantClientInstance.setPayload).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
					payload: newPayload,
				})

				expect(mockQdrantClientInstance.updateVectors).not.toHaveBeenCalled()
			})
		})

		describe("delete", () => {
			it("should delete point by ID", async () => {
				const testId = "fact-to-delete"

				await memoryStore.delete(testId)

				expect(mockQdrantClientInstance.delete).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
				})
			})
		})

		describe("get", () => {
			it("should retrieve point by ID with payload and vector", async () => {
				const testId = "fact-retrieve"
				const mockResponse = [
					{
						id: testId,
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Retrieved fact", category: "pattern" },
					},
				]

				mockQdrantClientInstance.retrieve.mockResolvedValue(mockResponse)

				const result = await memoryStore.get(testId)

				expect(mockQdrantClientInstance.retrieve).toHaveBeenCalledWith(expectedCollectionName, {
					ids: [testId],
					with_payload: true,
					with_vector: true,
				})

				expect(result).toEqual({
					id: testId,
					vector: [0.1, 0.2, 0.3],
					payload: { content: "Retrieved fact", category: "pattern" },
				})
			})

			it("should return undefined when point not found", async () => {
				mockQdrantClientInstance.retrieve.mockResolvedValue([])

				const result = await memoryStore.get("nonexistent-id")

				expect(result).toBeUndefined()
			})

			it("should handle null response gracefully", async () => {
				mockQdrantClientInstance.retrieve.mockResolvedValue(null)

				const result = await memoryStore.get("test-id")

				expect(result).toBeUndefined()
			})
		})
	})

	describe("Search Operations", () => {
		describe("search", () => {
			it("should perform vector search with filters", async () => {
				const queryText = "JWT authentication implementation"
				const queryEmbedding = [0.1, 0.2, 0.3, 0.4]
				const limit = 10
				const filters = { category: "architecture", workspace_path: "/test/workspace" }

				const mockSearchResults = {
					points: [
						{
							id: "result-1",
							score: 0.95,
							payload: { content: "JWT implementation details", category: "architecture" },
						},
						{
							id: "result-2",
							score: 0.87,
							payload: { content: "Authentication middleware setup", category: "architecture" },
						},
					],
				}

				mockQdrantClientInstance.query.mockResolvedValue(mockSearchResults)

				const results = await memoryStore.search(queryText, queryEmbedding, limit, filters)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(expectedCollectionName, {
					query: { vector: queryEmbedding, with_vector: false },
					limit,
					filter: {
						must: [
							{ key: "category", match: { value: "architecture" } },
							{ key: "workspace_path", match: { value: "/test/workspace" } },
						],
					},
					with_payload: true,
				})

				expect(results).toEqual([
					{
						id: "result-1",
						vector: [], // Empty vector array as per implementation
						payload: { content: "JWT implementation details", category: "architecture" },
						score: 0.95,
					},
					{
						id: "result-2",
						vector: [],
						payload: { content: "Authentication middleware setup", category: "architecture" },
						score: 0.87,
					},
				])
			})

			it("should handle search without filters", async () => {
				const queryEmbedding = [0.1, 0.2, 0.3]
				const mockResults = { points: [] }

				mockQdrantClientInstance.query.mockResolvedValue(mockResults)

				await memoryStore.search("test query", queryEmbedding, 5)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(expectedCollectionName, {
					query: { vector: queryEmbedding, with_vector: false },
					limit: 5,
					filter: undefined, // No filters
					with_payload: true,
				})
			})

			it("should filter out undefined values from filters", async () => {
				const filters = {
					category: "pattern",
					workspace_path: "/test/workspace",
					undefined_field: undefined, // Should be filtered out
				}

				mockQdrantClientInstance.query.mockResolvedValue({ points: [] })

				await memoryStore.search("test", [0.1], 5, filters)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(
					expectedCollectionName,
					expect.objectContaining({
						filter: {
							must: [
								{ key: "category", match: { value: "pattern" } },
								{ key: "workspace_path", match: { value: "/test/workspace" } },
								// undefined_field should not be included
							],
						},
					}),
				)
			})
		})

		describe("filter", () => {
			it("should perform filtered scroll with cursor support", async () => {
				const limit = 50
				const filters = { category: "debugging", resolved: false }
				const cursor = "next-page-token"

				const mockScrollResults = {
					points: [
						{
							id: "debug-1",
							payload: { content: "Unresolved CORS issue", category: "debugging", resolved: false },
						},
					],
					next_page_offset: "new-cursor-token",
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(mockScrollResults)

				const result = await memoryStore.filter(limit, filters, cursor)

				expect(mockQdrantClientInstance.scroll).toHaveBeenCalledWith(expectedCollectionName, {
					limit,
					filter: {
						must: [
							{ key: "category", match: { value: "debugging" } },
							{ key: "resolved", match: { value: false } },
						],
					},
					with_payload: true,
					with_vector: false,
					offset: cursor,
				})

				expect(result).toEqual({
					records: [
						{
							id: "debug-1",
							vector: [],
							payload: { content: "Unresolved CORS issue", category: "debugging", resolved: false },
						},
					],
					nextCursor: "new-cursor-token",
				})
			})

			it("should handle filtering without cursor", async () => {
				const mockResults = { points: [], next_page_offset: null }
				mockQdrantClientInstance.scroll.mockResolvedValue(mockResults)

				const result = await memoryStore.filter(20, { workspace_path: "/test" })

				expect(mockQdrantClientInstance.scroll).toHaveBeenCalledWith(
					expectedCollectionName,
					expect.not.objectContaining({ offset: expect.anything() }),
				)

				expect(result.nextCursor).toBeNull()
			})

			it("should handle empty filter results", async () => {
				const mockResults = { points: [] }
				mockQdrantClientInstance.scroll.mockResolvedValue(mockResults)

				const result = await memoryStore.filter(10, { category: "nonexistent" })

				expect(result.records).toEqual([])
				expect(result.nextCursor).toBeUndefined()
			})
		})
	})

	describe("Collection maintenance", () => {
		it("clearCollection deletes all points", async () => {
			await memoryStore.clearCollection()

			expect(mockQdrantClientInstance.delete).toHaveBeenCalledWith(expect.any(String), {
				filter: { must: [] },
				wait: true,
			})
		})

		it("deleteCollection drops the collection when supported", async () => {
			await memoryStore.deleteCollection()
			expect(mockQdrantClientInstance.deleteCollection).toHaveBeenCalledWith(expect.any(String))
		})
	})

	describe("Error Handling", () => {
		it("should propagate Qdrant client errors", async () => {
			const testError = new Error("Qdrant connection failed")
			mockQdrantClientInstance.upsert.mockRejectedValue(testError)

			const testRecord = {
				id: "test-fact",
				vector: [0.1, 0.2, 0.3],
				payload: { content: "Test fact" },
			}

			await expect(memoryStore.upsert([testRecord])).rejects.toThrow("Qdrant connection failed")
		})

		it("should handle search errors gracefully", async () => {
			const searchError = new Error("Search index not ready")
			mockQdrantClientInstance.query.mockRejectedValue(searchError)

			await expect(memoryStore.search("test", [0.1], 5)).rejects.toThrow("Search index not ready")
		})

		it("should handle malformed search results", async () => {
			// Mock malformed response
			mockQdrantClientInstance.query.mockResolvedValue({
				points: [
					{ id: "malformed-1" }, // Missing expected fields
					{ id: "malformed-2", score: 0.5 }, // Missing payload
				],
			})

			const results = await memoryStore.search("test", [0.1], 5)

			// Should handle gracefully, returning what's available
			expect(results).toHaveLength(2)
			expect(results[0]).toEqual({
				id: "malformed-1",
				vector: [],
				payload: undefined,
				score: undefined,
			})
		})
	})

	describe("Workspace Isolation", () => {
		it("should use workspace-specific collection names", () => {
			const workspace1Store = new QdrantMemoryStore("/workspace1", mockQdrantUrl, mockDimension)

			// Mock different hash for different workspace
			mockCreateHashInstance.digest.mockReturnValueOnce("different-hash-123456789012345678901234567890")
			const workspace2Store = new QdrantMemoryStore("/workspace2", mockQdrantUrl, mockDimension)

			expect(workspace1Store.collectionName()).not.toBe(workspace2Store.collectionName())
			expect(workspace1Store.collectionName()).toContain("-memory")
			expect(workspace2Store.collectionName()).toContain("-memory")
		})
	})

	describe("Collection Name Format", () => {
		it("should follow memory-specific naming convention", () => {
			const collectionName = memoryStore.collectionName()

			expect(collectionName).toMatch(/^ws-[a-f0-9]{16}-memory$/)
			expect(collectionName).toContain("-memory") // Distinguishes from code-index collections
		})

		it("should truncate workspace hash to 16 characters", () => {
			const longHash = "a".repeat(64) // Full SHA-256 hash length
			mockCreateHashInstance.digest.mockReturnValue(longHash)

			const store = new QdrantMemoryStore("/test", mockQdrantUrl, mockDimension)
			const collectionName = store.collectionName()

			expect(collectionName).toBe(`ws-${"a".repeat(16)}-memory`)
			expect(collectionName.length).toBeLessThan(40) // Reasonable collection name length
		})
	})
})
