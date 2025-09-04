import { QdrantClient } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import { QdrantMemoryStore } from "../storage/qdrant-memory-store"
import { ensureCollection } from "../../qdrant/common"
import { QdrantClientSingleton } from "../../qdrant/client-singleton"

// Mocks following established pattern
vi.mock("@qdrant/js-client-rest")
vi.mock("crypto")
vi.mock("../../qdrant/common")
vi.mock("../../qdrant/client-singleton")

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

		// Reset all mock implementations to successful defaults
		mockQdrantClientInstance.getCollection.mockResolvedValue({} as any)
		mockQdrantClientInstance.createCollection.mockResolvedValue({} as any)
		mockQdrantClientInstance.deleteCollection.mockResolvedValue({} as any)
		mockQdrantClientInstance.createPayloadIndex.mockResolvedValue({} as any)
		mockQdrantClientInstance.upsert.mockResolvedValue({} as any)
		mockQdrantClientInstance.query.mockResolvedValue({ points: [] })
		mockQdrantClientInstance.delete.mockResolvedValue({} as any)
		mockQdrantClientInstance.retrieve.mockResolvedValue([])
		mockQdrantClientInstance.setPayload.mockResolvedValue({} as any)
		mockQdrantClientInstance.updateVectors.mockResolvedValue({} as any)
		mockQdrantClientInstance.scroll.mockResolvedValue({ points: [] })

		// Mock QdrantClientSingleton.getInstance
		vi.mocked(QdrantClientSingleton.getInstance).mockReturnValue(mockQdrantClientInstance as any)

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
			expect(QdrantClientSingleton.getInstance).toHaveBeenCalledWith(mockQdrantUrl, mockApiKey)
			expect(createHash).toHaveBeenCalledWith("sha256")
			expect(mockCreateHashInstance.update).toHaveBeenCalledWith(mockWorkspacePath)
			expect(mockCreateHashInstance.digest).toHaveBeenCalledWith("hex")
			expect(memoryStore.collectionName()).toBe(expectedCollectionName)
		})

		it("should handle constructor with default URL when none provided", () => {
			const memoryStoreWithDefaults = new QdrantMemoryStore(mockWorkspacePath, undefined as any, mockDimension)

			expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(undefined, undefined)
		})

		it("should handle constructor without API key", () => {
			const storeWithoutKey = new QdrantMemoryStore(mockWorkspacePath, mockQdrantUrl, mockDimension)

			expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(mockQdrantUrl, undefined)
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

	describe("URL Parsing and Client Creation", () => {
		/**
		 * These tests verify that QdrantMemoryStore correctly passes URL parameters
		 * to QdrantClientSingleton.getInstance, which handles the client creation logic.
		 * Tests adapted from QdrantVectorStore comprehensive URL parsing suite.
		 */
		describe("HTTPS URL handling", () => {
			it("should pass HTTPS URLs without port to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(
					mockWorkspacePath,
					"https://qdrant.ashbyfam.com",
					mockDimension,
				)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(
					"https://qdrant.ashbyfam.com",
					undefined,
				)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass HTTPS URLs with explicit port to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "https://example.com:9000", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(
					"https://example.com:9000",
					undefined,
				)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass HTTPS URLs with paths and query parameters to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(
					mockWorkspacePath,
					"https://example.com/api/v1?key=value",
					mockDimension,
				)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(
					"https://example.com/api/v1?key=value",
					undefined,
				)
				expect(memoryStore.collectionName()).toContain("-memory")
			})
		})

		describe("HTTP URL handling", () => {
			it("should pass HTTP URLs without port to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "http://example.com", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("http://example.com", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass HTTP URLs with explicit port to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "http://localhost:8080", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("http://localhost:8080", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass HTTP URLs with paths and query parameters to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(
					mockWorkspacePath,
					"http://example.com/api/v1?key=value",
					mockDimension,
				)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(
					"http://example.com/api/v1?key=value",
					undefined,
				)
				expect(memoryStore.collectionName()).toContain("-memory")
			})
		})

		describe("Hostname handling", () => {
			it("should pass hostname without protocol to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "qdrant.example.com", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("qdrant.example.com", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass hostname:port format to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "localhost:6333", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("localhost:6333", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass explicit HTTP URLs correctly to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "http://localhost:9000", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("http://localhost:9000", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})
		})

		describe("IP address handling", () => {
			it("should pass IP address without port to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "192.168.1.100", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("192.168.1.100", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass IP:port format to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "192.168.1.100:6333", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("192.168.1.100:6333", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})
		})

		describe("Edge cases", () => {
			it("should handle undefined URL by passing to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, undefined as any, mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(undefined, undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should handle empty string URL by passing to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should handle whitespace-only URL by passing to QdrantClientSingleton.getInstance", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "   ", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("   ", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})
		})

		describe("Invalid URL fallback", () => {
			it("should pass invalid URLs to QdrantClientSingleton.getInstance for handling", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, "invalid-url-format", mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith("invalid-url-format", undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})
		})

		describe("API Key handling", () => {
			it("should pass API key to QdrantClientSingleton.getInstance when provided", () => {
				const apiKey = "test-api-key-12345"
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, mockQdrantUrl, mockDimension, apiKey)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(mockQdrantUrl, apiKey)
				expect(memoryStore.collectionName()).toContain("-memory")
			})

			it("should pass undefined API key to QdrantClientSingleton.getInstance when not provided", () => {
				const memoryStore = new QdrantMemoryStore(mockWorkspacePath, mockQdrantUrl, mockDimension)

				expect(QdrantClientSingleton.getInstance).toHaveBeenLastCalledWith(mockQdrantUrl, undefined)
				expect(memoryStore.collectionName()).toContain("-memory")
			})
		})
	})

	describe("Collection Management and Initialization", () => {
		/**
		 * Comprehensive collection management tests adapted from code-index QdrantVectorStore
		 * Tests ensureCollection integration with dimension validation, recreation logic, and error handling
		 */
		describe("ensureCollection with workspace collections", () => {
			it("should create new collection when none exists using ensureCollection", async () => {
				// Mock ensureCollection to return true (collection was created)
				vi.mocked(ensureCollection).mockResolvedValue(true)

				const customName = "ws-test123456789-memory"
				const customDimension = 768

				await memoryStore.ensureCollection(customName, customDimension)

				// CRITICAL FIX: ensureCollection should always use workspace-derived collection name
				// to prevent inconsistencies that cause "Not Found" errors
				const expectedCollectionName = memoryStore.collectionName()
				expect(ensureCollection).toHaveBeenCalledWith(
					mockQdrantClientInstance,
					expectedCollectionName,
					customDimension,
					{
						distance: "Cosine",
						onDisk: true,
						hnsw: { m: 64, ef_construct: 512, on_disk: true },
					},
				)

				// Collection name should remain consistent (workspace-derived)
				expect(memoryStore.collectionName()).toBe(expectedCollectionName)
			})

			it("should use existing collection when dimensions match", async () => {
				// Mock ensureCollection to return false (collection already existed)
				vi.mocked(ensureCollection).mockResolvedValue(false)

				const existingName = "ws-existing456789-memory"
				const matchingDimension = 1536

				await memoryStore.ensureCollection(existingName, matchingDimension)

				expect(ensureCollection).toHaveBeenCalledWith(
					mockQdrantClientInstance,
					existingName,
					matchingDimension,
					{
						distance: "Cosine",
						onDisk: true,
						hnsw: { m: 64, ef_construct: 512, on_disk: true },
					},
				)

				expect(memoryStore.collectionName()).toBe(existingName)
			})

			it("should recreate collection when dimensions mismatch", async () => {
				// Mock ensureCollection to return true (collection was recreated due to dimension mismatch)
				vi.mocked(ensureCollection).mockResolvedValue(true)

				const mismatchName = "ws-mismatch789012-memory"
				const newDimension = 768 // Different from existing

				await memoryStore.ensureCollection(mismatchName, newDimension)

				expect(ensureCollection).toHaveBeenCalledWith(mockQdrantClientInstance, mismatchName, newDimension, {
					distance: "Cosine",
					onDisk: true,
					hnsw: { m: 64, ef_construct: 512, on_disk: true },
				})

				expect(memoryStore.collectionName()).toBe(mismatchName)
			})
		})

		describe("Collection naming validation", () => {
			it("should enforce memory-specific collection naming convention", async () => {
				vi.mocked(ensureCollection).mockResolvedValue(true)

				// Test with properly formatted memory collection name
				const validMemoryName = "ws-abcdef1234567890-memory"
				await memoryStore.ensureCollection(validMemoryName, 1536)

				expect(ensureCollection).toHaveBeenCalledWith(
					mockQdrantClientInstance,
					validMemoryName,
					1536,
					expect.any(Object),
				)
				expect(memoryStore.collectionName()).toBe(validMemoryName)
			})

			it("should handle workspace-specific memory collections", async () => {
				vi.mocked(ensureCollection).mockResolvedValue(true)

				// Different workspace should have different collection name
				const workspace1Name = "ws-workspace1hash1-memory"
				const workspace2Name = "ws-workspace2hash2-memory"

				await memoryStore.ensureCollection(workspace1Name, 1536)
				expect(memoryStore.collectionName()).toBe(workspace1Name)

				await memoryStore.ensureCollection(workspace2Name, 1536)
				expect(memoryStore.collectionName()).toBe(workspace2Name)

				// Both should be distinct
				expect(workspace1Name).not.toBe(workspace2Name)
				expect(workspace1Name).toContain("-memory")
				expect(workspace2Name).toContain("-memory")
			})

			it("should validate collection name format for memory stores", () => {
				const currentCollectionName = memoryStore.collectionName()

				// Should follow pattern: ws-{16-char-hash}-memory
				expect(currentCollectionName).toMatch(/^ws-[a-f0-9]{16}-memory$/)
				expect(currentCollectionName).toContain("-memory")
				expect(currentCollectionName.length).toBeLessThan(40)
			})
		})

		describe("Collection configuration", () => {
			it("should use correct vector configuration for memory collections", async () => {
				vi.mocked(ensureCollection).mockResolvedValue(true)

				const testDimension = 384
				const testName = "ws-config123456789-memory"

				await memoryStore.ensureCollection(testName, testDimension)

				expect(ensureCollection).toHaveBeenCalledWith(mockQdrantClientInstance, testName, testDimension, {
					distance: "Cosine",
					onDisk: true,
					hnsw: {
						m: 64,
						ef_construct: 512,
						on_disk: true,
					},
				})
			})

			it("should always use default configuration regardless of parameters", async () => {
				vi.mocked(ensureCollection).mockResolvedValue(true)

				// The ensureCollection method in the actual implementation doesn't accept custom config
				// It always uses the hardcoded default configuration
				await memoryStore.ensureCollection("ws-default567890123-memory", 512)

				expect(ensureCollection).toHaveBeenCalledWith(
					mockQdrantClientInstance,
					"ws-default567890123-memory",
					512,
					{
						distance: "Cosine",
						onDisk: true,
						hnsw: { m: 64, ef_construct: 512, on_disk: true },
					},
				)
			})
		})

		describe("Error handling and recovery", () => {
			it("should propagate ensureCollection errors", async () => {
				const collectionError = new Error("Failed to create memory collection")
				vi.mocked(ensureCollection).mockRejectedValue(collectionError)

				await expect(memoryStore.ensureCollection("ws-error123456789-memory", 1536)).rejects.toThrow(
					"Failed to create memory collection",
				)

				expect(ensureCollection).toHaveBeenCalledWith(
					mockQdrantClientInstance,
					"ws-error123456789-memory",
					1536,
					expect.any(Object),
				)
			})

			it("should handle network errors during collection operations", async () => {
				const networkError = new Error("Connection timeout")
				vi.mocked(ensureCollection).mockRejectedValue(networkError)

				await expect(memoryStore.ensureCollection("ws-network78901234-memory", 768)).rejects.toThrow(
					"Connection timeout",
				)
			})

			it("should handle malformed collection responses", async () => {
				// Mock ensureCollection to simulate unexpected behavior
				vi.mocked(ensureCollection).mockResolvedValue(undefined as any)

				// Should handle gracefully without throwing
				const result = await memoryStore.ensureCollection("ws-malformed34567-memory", 1024)

				expect(result).toBeUndefined()
				expect(ensureCollection).toHaveBeenCalled()
			})
		})

		describe("Dimension validation scenarios", () => {
			/**
			 * Tests for dimension mismatch detection and collection recreation
			 * Adapted from code-index tests that verify vectorSize compatibility
			 */
			it("should handle dimension changes correctly", async () => {
				// First call with original dimension
				vi.mocked(ensureCollection).mockResolvedValueOnce(false) // Collection existed
				await memoryStore.ensureCollection("ws-dimension123456-memory", 1536)

				// Second call with different dimension should trigger recreation
				vi.mocked(ensureCollection).mockResolvedValueOnce(true) // Collection recreated
				await memoryStore.ensureCollection("ws-dimension123456-memory", 768)

				expect(ensureCollection).toHaveBeenCalledTimes(2)
				expect(ensureCollection).toHaveBeenLastCalledWith(
					mockQdrantClientInstance,
					"ws-dimension123456-memory",
					768,
					expect.any(Object),
				)
			})

			it("should validate supported dimension ranges", async () => {
				vi.mocked(ensureCollection).mockResolvedValue(true)

				// Test various dimension sizes
				const testDimensions = [256, 384, 512, 768, 1024, 1536, 2048]

				for (const dim of testDimensions) {
					const testName = `ws-dim${dim}test-memory`
					await memoryStore.ensureCollection(testName, dim)

					expect(ensureCollection).toHaveBeenCalledWith(
						mockQdrantClientInstance,
						testName,
						dim,
						expect.any(Object),
					)
				}

				expect(ensureCollection).toHaveBeenCalledTimes(testDimensions.length)
			})

			it("should handle zero or negative dimensions gracefully", async () => {
				vi.mocked(ensureCollection).mockResolvedValue(true)

				// These should still call ensureCollection (validation handled there)
				await memoryStore.ensureCollection("ws-zero123456789-memory", 0)
				await memoryStore.ensureCollection("ws-negative123456-memory", -1)

				expect(ensureCollection).toHaveBeenCalledWith(
					mockQdrantClientInstance,
					"ws-zero123456789-memory",
					0,
					expect.any(Object),
				)
				expect(ensureCollection).toHaveBeenCalledWith(
					mockQdrantClientInstance,
					"ws-negative123456-memory",
					-1,
					expect.any(Object),
				)
			})
		})
	})

	describe("Vector Operations", () => {
		/**
		 * Comprehensive CRUD operation tests adapted from code-index implementation
		 * Enhanced with memory-specific payload structures and error scenarios
		 */
		describe("upsert", () => {
			it("should upsert records with memory-specific payload structure", async () => {
				const testRecords = [
					{
						id: "memory-fact-1",
						vector: [0.1, 0.2, 0.3],
						payload: {
							content: "User authentication pattern established",
							category: "architecture",
							workspace_path: "/test/workspace",
							created_at: "2024-01-01T00:00:00Z",
							confidence: 0.95,
						},
					},
					{
						id: "memory-fact-2",
						vector: [0.4, 0.5, 0.6],
						payload: {
							content: "Database connection pool optimized",
							category: "infrastructure",
							workspace_path: "/test/workspace",
							resolved: true,
							priority: "high",
						},
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

			it("should handle records with diverse payload structures", async () => {
				const diverseRecords = [
					{
						id: "simple-fact",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Simple fact" },
					},
					{
						id: "complex-fact",
						vector: [0.4, 0.5, 0.6],
						payload: {
							content: "Complex fact with metadata",
							category: "debugging",
							tags: ["important", "resolved"],
							metadata: {
								source: "user_input",
								confidence_score: 0.87,
							},
						},
					},
				]

				await memoryStore.upsert(diverseRecords)

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: diverseRecords,
				})
			})

			it("should propagate upsert errors from Qdrant client", async () => {
				const testError = new Error("Qdrant upsert failed")
				mockQdrantClientInstance.upsert.mockRejectedValue(testError)

				const testRecord = {
					id: "test-fact",
					vector: [0.1, 0.2, 0.3],
					payload: { content: "Test fact" },
				}

				await expect(memoryStore.upsert([testRecord])).rejects.toThrow("Qdrant upsert failed")
			})
		})

		describe("insert", () => {
			it("should insert vectors with proper point structure", async () => {
				const vectors = [
					[0.1, 0.2, 0.3],
					[0.4, 0.5, 0.6],
				]
				const ids = ["memory-id-1", "memory-id-2"]
				const payloads = [
					{ content: "First memory fact", category: "pattern", workspace_path: "/test" },
					{ content: "Second memory fact", category: "debugging", resolved: false },
				]

				await memoryStore.insert(vectors, ids, payloads)

				const expectedPoints = [
					{ id: "memory-id-1", vector: [0.1, 0.2, 0.3], payload: payloads[0] },
					{ id: "memory-id-2", vector: [0.4, 0.5, 0.6], payload: payloads[1] },
				]

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: expectedPoints,
				})
			})

			it("should filter out points with empty vectors", async () => {
				const vectors = [
					[0.1, 0.2, 0.3],
					[], // Empty vector
					[0.4, 0.5, 0.6],
				]
				const ids = ["valid-1", "invalid", "valid-2"]
				const payloads = [{ content: "Valid fact 1" }, { content: "Invalid fact" }, { content: "Valid fact 2" }]

				await memoryStore.insert(vectors, ids, payloads)

				const expectedPoints = [
					{ id: "valid-1", vector: [0.1, 0.2, 0.3], payload: { content: "Valid fact 1" } },
					{ id: "valid-2", vector: [0.4, 0.5, 0.6], payload: { content: "Valid fact 2" } },
				]

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: expectedPoints,
				})
			})

			it("should filter out points with undefined vectors", async () => {
				const vectors = [[0.1, 0.2], undefined as any]
				const ids = ["id-1", "id-2"]
				const payloads = [{ content: "fact 1" }, { content: "fact 2" }]

				await memoryStore.insert(vectors, ids, payloads)

				const expectedPoints = [{ id: "id-1", vector: [0.1, 0.2], payload: { content: "fact 1" } }]

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: expectedPoints,
				})
			})

			it("should handle mismatched array lengths gracefully", async () => {
				const vectors = [[0.1, 0.2, 0.3]]
				const ids = ["id-1", "id-2", "id-3"] // More IDs than vectors
				const payloads = [{ content: "fact" }]

				await memoryStore.insert(vectors, ids, payloads)

				// Should only process valid combinations
				const expectedPoints = [{ id: "id-1", vector: [0.1, 0.2, 0.3], payload: { content: "fact" } }]

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: expectedPoints,
				})
			})

			it("should handle all empty vectors scenario", async () => {
				const vectors = [[], []]
				const ids = ["id-1", "id-2"]
				const payloads = [{ content: "fact 1" }, { content: "fact 2" }]

				await memoryStore.insert(vectors, ids, payloads)

				// Implementation returns early when no valid points, so upsert should not be called
				expect(mockQdrantClientInstance.upsert).not.toHaveBeenCalled()
			})

			it("should propagate insert errors from Qdrant client", async () => {
				const insertError = new Error("Insert operation failed")
				mockQdrantClientInstance.upsert.mockRejectedValue(insertError)

				const vectors = [[0.1, 0.2, 0.3]]
				const ids = ["test-id"]
				const payloads = [{ content: "test fact" }]

				await expect(memoryStore.insert(vectors, ids, payloads)).rejects.toThrow("Insert operation failed")
			})
		})

		describe("update", () => {
			it("should update payload and vector when both provided", async () => {
				const testId = "memory-fact-123"
				const newVector = [0.7, 0.8, 0.9]
				const newPayload = {
					content: "Updated memory fact",
					category: "architecture",
					resolved: true,
					updated_at: "2024-01-02T00:00:00Z",
				}

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
				const testId = "memory-fact-456"
				const newPayload = {
					content: "Payload only update",
					resolved: true,
					priority: "low",
					notes: "Additional context added",
				}

				await memoryStore.update(testId, null, newPayload)

				expect(mockQdrantClientInstance.setPayload).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
					payload: newPayload,
				})

				expect(mockQdrantClientInstance.updateVectors).not.toHaveBeenCalled()
			})

			it("should update only payload when vector is undefined", async () => {
				const testId = "memory-fact-789"
				const newPayload = { content: "Undefined vector test", category: "testing" }

				await memoryStore.update(testId, undefined as any, newPayload)

				expect(mockQdrantClientInstance.setPayload).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
					payload: newPayload,
				})

				expect(mockQdrantClientInstance.updateVectors).not.toHaveBeenCalled()
			})

			it("should handle empty payload updates", async () => {
				const testId = "memory-fact-empty"
				const emptyPayload = {}

				await memoryStore.update(testId, null, emptyPayload)

				expect(mockQdrantClientInstance.setPayload).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
					payload: emptyPayload,
				})
			})

			it("should propagate setPayload errors", async () => {
				const payloadError = new Error("Failed to set payload")
				mockQdrantClientInstance.setPayload.mockRejectedValue(payloadError)

				const testId = "error-test-id"
				const newPayload = { content: "Test content" }

				await expect(memoryStore.update(testId, null, newPayload)).rejects.toThrow("Failed to set payload")
			})

			it("should propagate updateVectors errors", async () => {
				const vectorError = new Error("Failed to update vectors")
				mockQdrantClientInstance.setPayload.mockResolvedValue({} as any)
				mockQdrantClientInstance.updateVectors.mockRejectedValue(vectorError)

				const testId = "vector-error-test"
				const newVector = [0.1, 0.2, 0.3]
				const newPayload = { content: "Test content" }

				await expect(memoryStore.update(testId, newVector, newPayload)).rejects.toThrow(
					"Failed to update vectors",
				)
			})
		})

		describe("delete", () => {
			it("should delete point by ID", async () => {
				const testId = "memory-fact-to-delete"

				await memoryStore.delete(testId)

				expect(mockQdrantClientInstance.delete).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
				})
			})

			it("should handle deletion of non-existent points", async () => {
				const nonExistentId = "non-existent-memory"
				mockQdrantClientInstance.delete.mockResolvedValue({} as any)

				await memoryStore.delete(nonExistentId)

				expect(mockQdrantClientInstance.delete).toHaveBeenCalledWith(expectedCollectionName, {
					points: [nonExistentId],
				})
			})

			it("should propagate delete errors from Qdrant client", async () => {
				const deleteError = new Error("Delete operation failed")
				mockQdrantClientInstance.delete.mockRejectedValue(deleteError)

				const testId = "delete-error-test"

				await expect(memoryStore.delete(testId)).rejects.toThrow("Delete operation failed")

				expect(mockQdrantClientInstance.delete).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testId],
				})
			})

			it("should handle special character IDs", async () => {
				const specialId = "memory-fact_with@special#chars$123"

				await memoryStore.delete(specialId)

				expect(mockQdrantClientInstance.delete).toHaveBeenCalledWith(expectedCollectionName, {
					points: [specialId],
				})
			})
		})

		describe("get", () => {
			it("should retrieve point by ID with payload and vector", async () => {
				const testId = "memory-fact-retrieve"
				const mockResponse = [
					{
						id: testId,
						vector: [0.1, 0.2, 0.3],
						payload: {
							content: "Retrieved memory fact",
							category: "pattern",
							workspace_path: "/test/workspace",
							created_at: "2024-01-01T00:00:00Z",
						},
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
					payload: {
						content: "Retrieved memory fact",
						category: "pattern",
						workspace_path: "/test/workspace",
						created_at: "2024-01-01T00:00:00Z",
					},
				})
			})

			it("should return undefined when point not found", async () => {
				mockQdrantClientInstance.retrieve.mockResolvedValue([])

				const result = await memoryStore.get("nonexistent-memory-id")

				expect(result).toBeUndefined()
			})

			it("should handle null response gracefully", async () => {
				mockQdrantClientInstance.retrieve.mockResolvedValue(null)

				const result = await memoryStore.get("test-memory-id")

				expect(result).toBeUndefined()
			})

			it("should handle undefined response gracefully", async () => {
				mockQdrantClientInstance.retrieve.mockResolvedValue(undefined as any)

				const result = await memoryStore.get("undefined-test-id")

				expect(result).toBeUndefined()
			})

			it("should handle malformed response gracefully", async () => {
				// Mock response with missing fields
				const malformedResponse = [
					{
						id: "malformed-id",
						// Missing vector and payload
					},
				]

				mockQdrantClientInstance.retrieve.mockResolvedValue(malformedResponse)

				const result = await memoryStore.get("malformed-id")

				expect(result).toEqual({
					id: "malformed-id",
					vector: undefined,
					payload: undefined,
				})
			})

			it("should propagate retrieve errors from Qdrant client", async () => {
				const retrieveError = new Error("Failed to retrieve point")
				mockQdrantClientInstance.retrieve.mockRejectedValue(retrieveError)

				await expect(memoryStore.get("error-test-id")).rejects.toThrow("Failed to retrieve point")
			})

			it("should handle special character IDs in retrieval", async () => {
				const specialId = "memory@fact#with$special%chars"
				const mockResponse = [
					{
						id: specialId,
						vector: [0.5, 0.6, 0.7],
						payload: { content: "Special character test" },
					},
				]

				mockQdrantClientInstance.retrieve.mockResolvedValue(mockResponse)

				const result = await memoryStore.get(specialId)

				expect(mockQdrantClientInstance.retrieve).toHaveBeenCalledWith(expectedCollectionName, {
					ids: [specialId],
					with_payload: true,
					with_vector: true,
				})

				expect(result).toEqual({
					id: specialId,
					vector: [0.5, 0.6, 0.7],
					payload: { content: "Special character test" },
				})
			})
		})
	})

	describe("Search Operations", () => {
		describe("search", () => {
			it("should perform vector search with filters", async () => {
				const queryText = "JWT authentication implementation"
				const queryEmbedding = new Array(mockDimension).fill(0.1) // Correct dimension
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
					query: queryEmbedding, // Direct vector, no nesting
					limit,
					filter: {
						must: [
							{ key: "category", match: { value: "architecture" } },
							{ key: "workspace_path", match: { value: "/test/workspace" } },
						],
					},
					with_payload: true,
					with_vector: false,
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
				const queryEmbedding = new Array(mockDimension).fill(0.1) // Correct dimension
				const mockResults = { points: [] }

				mockQdrantClientInstance.query.mockResolvedValue(mockResults)

				await memoryStore.search("test query", queryEmbedding, 5)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(expectedCollectionName, {
					query: queryEmbedding, // Direct vector
					limit: 5,
					filter: undefined, // No filters
					with_payload: true,
					with_vector: false,
				})
			})

			it("should filter out undefined values from filters", async () => {
				const filters = {
					category: "pattern",
					workspace_path: "/test/workspace",
					undefined_field: undefined, // Should be filtered out
				}

				mockQdrantClientInstance.query.mockResolvedValue({ points: [] })

				const queryEmbedding = new Array(mockDimension).fill(0.1) // Correct dimension
				await memoryStore.search("test", queryEmbedding, 5, filters)

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

			it("should return empty array when embedding dimension mismatch", async () => {
				// Test dimension validation - should return empty array without calling query
				const wrongDimensionEmbedding = [0.1, 0.2] // Wrong dimension (2 instead of 1536)

				const results = await memoryStore.search("test", wrongDimensionEmbedding, 5)

				expect(results).toEqual([])
				expect(mockQdrantClientInstance.query).not.toHaveBeenCalled()
			})

			it("should return empty array when embedding is empty", async () => {
				const results = await memoryStore.search("test", [], 5)

				expect(results).toEqual([])
				expect(mockQdrantClientInstance.query).not.toHaveBeenCalled()
			})

			/**
			 * Additional comprehensive search tests adapted from code-index implementation
			 * These test various filter scenarios, edge cases, and error handling patterns
			 */
			it("should apply category-based filtering correctly", async () => {
				const queryEmbedding = new Array(mockDimension).fill(0.1)
				const categoryFilter = "debugging"
				const mockSearchResults = {
					points: [
						{
							id: "debug-1",
							score: 0.85,
							payload: {
								content: "Database connection timeout issue",
								category: "debugging",
								workspace_path: "/test/workspace",
							},
						},
					],
				}

				mockQdrantClientInstance.query.mockResolvedValue(mockSearchResults)

				const results = await memoryStore.search("database issue", queryEmbedding, 10, {
					category: categoryFilter,
				})

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(expectedCollectionName, {
					query: queryEmbedding,
					limit: 10,
					filter: {
						must: [
							{
								key: "category",
								match: { value: "debugging" },
							},
						],
					},
					with_payload: true,
					with_vector: false,
				})

				expect(results).toEqual([
					{
						id: "debug-1",
						vector: [],
						payload: {
							content: "Database connection timeout issue",
							category: "debugging",
							workspace_path: "/test/workspace",
						},
						score: 0.85,
					},
				])
			})

			it("should handle complex multi-field filtering", async () => {
				const queryEmbedding = new Array(mockDimension).fill(0.1)
				const complexFilters = {
					category: "pattern",
					workspace_path: "/test/workspace",
					resolved: false,
					priority: "high",
				}
				const mockResults = { points: [] }

				mockQdrantClientInstance.query.mockResolvedValue(mockResults)

				await memoryStore.search("complex query", queryEmbedding, 5, complexFilters)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(expectedCollectionName, {
					query: queryEmbedding,
					limit: 5,
					filter: {
						must: [
							{ key: "category", match: { value: "pattern" } },
							{ key: "workspace_path", match: { value: "/test/workspace" } },
							{ key: "resolved", match: { value: false } },
							{ key: "priority", match: { value: "high" } },
						],
					},
					with_payload: true,
					with_vector: false,
				})
			})

			it("should handle scenarios where no results are found", async () => {
				const queryEmbedding = new Array(mockDimension).fill(0.1)
				const mockEmptyResults = { points: [] }

				mockQdrantClientInstance.query.mockResolvedValue(mockEmptyResults)

				const results = await memoryStore.search("nonexistent query", queryEmbedding, 10)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledTimes(1)
				expect(results).toEqual([])
			})

			it("should handle malformed search results gracefully", async () => {
				const queryEmbedding = new Array(mockDimension).fill(0.1)
				// Mock malformed response
				mockQdrantClientInstance.query.mockResolvedValue({
					points: [
						{ id: "malformed-1" }, // Missing expected fields
						{ id: "malformed-2", score: 0.5 }, // Missing payload
					],
				})

				const results = await memoryStore.search("test", queryEmbedding, 5)

				// Should handle gracefully, returning what's available
				expect(results).toHaveLength(2)
				expect(results[0]).toEqual({
					id: "malformed-1",
					vector: [],
					payload: undefined,
					score: undefined,
				})
			})

			it("should return empty array on search errors instead of throwing", async () => {
				const searchError = new Error("Search index not ready")
				mockQdrantClientInstance.query.mockRejectedValue(searchError)

				// Create embedding with correct dimension
				const correctEmbedding = new Array(mockDimension).fill(0.1)
				const results = await memoryStore.search("test", correctEmbedding, 5)

				// Should return empty array instead of throwing
				expect(results).toEqual([])
			})

			it("should handle boolean filter values correctly", async () => {
				const queryEmbedding = new Array(mockDimension).fill(0.1)
				const filters = {
					category: "architecture",
					resolved: true, // Boolean value
					archived: false, // Boolean value
				}

				mockQdrantClientInstance.query.mockResolvedValue({ points: [] })

				await memoryStore.search("test", queryEmbedding, 5, filters)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(
					expectedCollectionName,
					expect.objectContaining({
						filter: {
							must: [
								{ key: "category", match: { value: "architecture" } },
								{ key: "resolved", match: { value: true } },
								{ key: "archived", match: { value: false } },
							],
						},
					}),
				)
			})

			it("should handle numeric filter values correctly", async () => {
				const queryEmbedding = new Array(mockDimension).fill(0.1)
				const filters = {
					category: "performance",
					priority_level: 3, // Numeric value
					confidence_score: 0.85, // Float value
				}

				mockQdrantClientInstance.query.mockResolvedValue({ points: [] })

				await memoryStore.search("test", queryEmbedding, 5, filters)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(
					expectedCollectionName,
					expect.objectContaining({
						filter: {
							must: [
								{ key: "category", match: { value: "performance" } },
								{ key: "priority_level", match: { value: 3 } },
								{ key: "confidence_score", match: { value: 0.85 } },
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

	describe("Memory-Specific Feature Tests", () => {
		/**
		 * Phase 4: Memory-Specific Features
		 * Comprehensive tests for functionality unique to QdrantMemoryStore
		 * that doesn't exist in the code-index implementation
		 */

		describe("filter() Method with Pagination Support", () => {
			/**
			 * Tests for the memory-specific filter method that supports cursor-based pagination
			 * This is unique to QdrantMemoryStore and enables efficient conversation memory browsing
			 */
			it("should support multi-page pagination with cursor continuation", async () => {
				const limit = 10
				const filters = { category: "conversation", userId: "user123" }

				// First page request
				const firstPageResults = {
					points: [
						{
							id: "conv-1",
							payload: {
								content: "User asked about authentication",
								category: "conversation",
								userId: "user123",
								timestamp: 1640995200000,
							},
						},
						{
							id: "conv-2",
							payload: {
								content: "Explained JWT implementation",
								category: "conversation",
								userId: "user123",
								timestamp: 1640995260000,
							},
						},
					],
					next_page_offset: "page-2-cursor-abc123",
				}

				mockQdrantClientInstance.scroll.mockResolvedValueOnce(firstPageResults)

				const firstPage = await memoryStore.filter(limit, filters)

				expect(mockQdrantClientInstance.scroll).toHaveBeenCalledWith(expectedCollectionName, {
					limit,
					filter: {
						must: [
							{ key: "category", match: { value: "conversation" } },
							{ key: "userId", match: { value: "user123" } },
						],
					},
					with_payload: true,
					with_vector: false,
				})

				expect(firstPage.records).toHaveLength(2)
				expect(firstPage.nextCursor).toBe("page-2-cursor-abc123")

				// Second page request using cursor
				const secondPageResults = {
					points: [
						{
							id: "conv-3",
							payload: {
								content: "User implemented solution successfully",
								category: "conversation",
								userId: "user123",
								timestamp: 1640995320000,
							},
						},
					],
					next_page_offset: null, // No more pages
				}

				mockQdrantClientInstance.scroll.mockResolvedValueOnce(secondPageResults)

				const secondPage = await memoryStore.filter(limit, filters, "page-2-cursor-abc123")

				expect(mockQdrantClientInstance.scroll).toHaveBeenLastCalledWith(expectedCollectionName, {
					limit,
					filter: {
						must: [
							{ key: "category", match: { value: "conversation" } },
							{ key: "userId", match: { value: "user123" } },
						],
					},
					with_payload: true,
					with_vector: false,
					offset: "page-2-cursor-abc123",
				})

				expect(secondPage.records).toHaveLength(1)
				expect(secondPage.nextCursor).toBeNull()
			})

			it("should handle large result sets with proper pagination limits", async () => {
				const largeLimit = 100
				const filters = { category: "pattern" }

				// Mock large result set
				const largeResults = {
					points: new Array(100).fill(null).map((_, i) => ({
						id: `pattern-${i}`,
						payload: {
							content: `Pattern ${i} discovered`,
							category: "pattern",
							confidence: Math.random(),
							workspace_path: "/test/workspace",
						},
					})),
					next_page_offset: "large-set-cursor-def456",
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(largeResults)

				const result = await memoryStore.filter(largeLimit, filters)

				expect(mockQdrantClientInstance.scroll).toHaveBeenCalledWith(expectedCollectionName, {
					limit: largeLimit,
					filter: {
						must: [{ key: "category", match: { value: "pattern" } }],
					},
					with_payload: true,
					with_vector: false,
				})

				expect(result.records).toHaveLength(100)
				expect(result.nextCursor).toBe("large-set-cursor-def456")
				expect(result.records[0].id).toBe("pattern-0")
				expect(result.records[99].id).toBe("pattern-99")
			})

			it("should handle cursor-based filtering with complex filter combinations", async () => {
				const complexFilters = {
					category: "debugging",
					resolved: false,
					priority: "high",
					userId: "developer456",
					workspace_path: "/project/frontend",
				}
				const cursor = "complex-filter-cursor"
				const limit = 25

				const mockResults = {
					points: [
						{
							id: "complex-debug-1",
							payload: {
								content: "CORS error in production environment",
								category: "debugging",
								resolved: false,
								priority: "high",
								userId: "developer456",
								workspace_path: "/project/frontend",
								timestamp: 1640995400000,
							},
						},
					],
					next_page_offset: "next-complex-cursor",
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(mockResults)

				const result = await memoryStore.filter(limit, complexFilters, cursor)

				expect(mockQdrantClientInstance.scroll).toHaveBeenCalledWith(expectedCollectionName, {
					limit,
					filter: {
						must: [
							{ key: "category", match: { value: "debugging" } },
							{ key: "resolved", match: { value: false } },
							{ key: "priority", match: { value: "high" } },
							{ key: "userId", match: { value: "developer456" } },
							{ key: "workspace_path", match: { value: "/project/frontend" } },
						],
					},
					with_payload: true,
					with_vector: false,
					offset: cursor,
				})

				expect(result.records).toHaveLength(1)
				expect(result.nextCursor).toBe("next-complex-cursor")
				expect(result.records[0].payload.priority).toBe("high")
			})

			it("should handle empty results with pagination", async () => {
				const filters = { category: "nonexistent-category" }
				const limit = 50

				const emptyResults = {
					points: [],
					next_page_offset: undefined,
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(emptyResults)

				const result = await memoryStore.filter(limit, filters)

				expect(result.records).toEqual([])
				expect(result.nextCursor).toBeUndefined()
			})

			it("should handle pagination errors gracefully", async () => {
				const paginationError = new Error("Scroll operation failed")
				mockQdrantClientInstance.scroll.mockRejectedValue(paginationError)

				const filters = { category: "test" }
				const limit = 10

				await expect(memoryStore.filter(limit, filters)).rejects.toThrow("Scroll operation failed")
			})

			it("should handle cursor validation and invalid cursor scenarios", async () => {
				const invalidCursors = ["invalid-cursor-format", "", "   ", null, undefined, 123, {}]

				for (const cursor of invalidCursors) {
					mockQdrantClientInstance.scroll.mockResolvedValue({ points: [] })

					const result = await memoryStore.filter(10, { category: "test" }, cursor as any)

					// Should handle invalid cursors gracefully
					if (cursor) {
						expect(mockQdrantClientInstance.scroll).toHaveBeenLastCalledWith(
							expectedCollectionName,
							expect.objectContaining({ offset: cursor }),
						)
					} else {
						expect(mockQdrantClientInstance.scroll).toHaveBeenLastCalledWith(
							expectedCollectionName,
							expect.not.objectContaining({ offset: expect.anything() }),
						)
					}

					expect(result.records).toEqual([])
				}
			})

			it("should support zero and negative limit edge cases", async () => {
				const edgeLimits = [0, -1, -10]

				for (const limit of edgeLimits) {
					mockQdrantClientInstance.scroll.mockResolvedValue({ points: [] })

					const result = await memoryStore.filter(limit, { category: "test" })

					expect(mockQdrantClientInstance.scroll).toHaveBeenLastCalledWith(
						expectedCollectionName,
						expect.objectContaining({ limit }),
					)

					expect(result.records).toEqual([])
				}
			})
		})

		describe("Memory-Specific Payload Validation and Flexibility", () => {
			/**
			 * Tests for generic payload structures and metadata handling
			 * Memory stores need to handle arbitrary conversation data structures
			 */
			it("should handle conversation-specific payload structures", async () => {
				const conversationPayloads = [
					{
						content: "User question about React hooks",
						category: "conversation",
						timestamp: 1640995200000,
						userId: "user123",
						sessionId: "session-abc",
						context: {
							previousMessages: 3,
							topic: "react-development",
						},
					},
					{
						content: "Code pattern: authentication middleware",
						category: "pattern",
						confidence: 0.95,
						tags: ["auth", "middleware", "express"],
						metadata: {
							source: "code_analysis",
							file_path: "/src/middleware/auth.js",
							line_range: [15, 42],
						},
					},
					{
						content: "Bug resolved: memory leak in component",
						category: "debugging",
						resolved: true,
						resolution_date: "2024-01-15T10:30:00Z",
						affected_components: ["UserProfile", "Dashboard"],
						severity: "medium",
					},
				]

				for (let i = 0; i < conversationPayloads.length; i++) {
					const payload = conversationPayloads[i]
					const testRecord = {
						id: `conversation-payload-${i}`,
						vector: new Array(mockDimension).fill(0.1 * (i + 1)),
						payload,
					}

					await memoryStore.upsert([testRecord])

					expect(mockQdrantClientInstance.upsert).toHaveBeenLastCalledWith(expectedCollectionName, {
						points: [testRecord],
					})
				}

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledTimes(conversationPayloads.length)
			})

			it("should handle dynamic metadata fields", async () => {
				const dynamicPayloads = [
					{
						content: "Base content",
						// Dynamic fields that can vary by conversation
						custom_field_1: "value1",
						user_preference: { theme: "dark", lang: "en" },
						metrics: { engagement: 0.8, relevance: 0.9 },
					},
					{
						content: "Different structure",
						// Completely different metadata structure
						workflow_step: 3,
						attachments: ["file1.pdf", "image2.png"],
						collaborators: ["user1", "user2"],
						deadline: "2024-02-01",
					},
					{
						content: "Minimal metadata",
						// Very minimal metadata
						created_by: "system",
					},
				]

				const testRecords = dynamicPayloads.map((payload, i) => ({
					id: `dynamic-${i}`,
					vector: new Array(mockDimension).fill(0.1),
					payload,
				}))

				await memoryStore.upsert(testRecords)

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: testRecords,
				})
			})

			it("should handle nested object payload structures", async () => {
				const nestedPayload = {
					content: "Complex nested conversation data",
					category: "conversation",
					metadata: {
						user: {
							id: "user123",
							profile: {
								name: "John Doe",
								preferences: {
									notifications: true,
									theme: "dark",
								},
							},
						},
						conversation: {
							thread_id: "thread-abc-123",
							context: {
								previous_interactions: [
									{ type: "question", timestamp: 1640995100 },
									{ type: "answer", timestamp: 1640995160 },
								],
								environment: {
									platform: "vscode",
									version: "1.85.0",
									extensions: ["roo-coder", "prettier"],
								},
							},
						},
						analysis: {
							sentiment: { score: 0.7, confidence: 0.85 },
							topics: ["authentication", "security", "best-practices"],
							complexity: "intermediate",
						},
					},
				}

				const testRecord = {
					id: "nested-payload-test",
					vector: new Array(mockDimension).fill(0.1),
					payload: nestedPayload,
				}

				await memoryStore.upsert([testRecord])

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testRecord],
				})
			})

			it("should handle array-based payload fields", async () => {
				const arrayPayload = {
					content: "Multiple related memories",
					category: "pattern",
					tags: ["react", "hooks", "performance"],
					related_files: [
						"/src/components/UserProfile.tsx",
						"/src/hooks/useAuth.ts",
						"/src/utils/performance.js",
					],
					code_snippets: [
						{ language: "typescript", code: "const [user, setUser] = useState(null)" },
						{ language: "javascript", code: "export const debounce = (fn, delay) => {}" },
					],
					references: [
						{ type: "documentation", url: "https://reactjs.org/docs/hooks-intro.html" },
						{ type: "stackoverflow", url: "https://stackoverflow.com/questions/12345", votes: 156 },
					],
				}

				const testRecord = {
					id: "array-payload-test",
					vector: new Array(mockDimension).fill(0.1),
					payload: arrayPayload,
				}

				await memoryStore.upsert([testRecord])

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testRecord],
				})
			})

			it("should handle special value types in payloads", async () => {
				const specialValuesPayload = {
					content: "Testing special payload values",
					category: "testing",
					// Various data types
					string_field: "normal string",
					number_field: 42,
					float_field: 3.14159,
					boolean_true: true,
					boolean_false: false,
					null_field: null,
					undefined_field: undefined,
					date_field: new Date("2024-01-01T00:00:00Z"),
					bigint_field: BigInt(9007199254740991),
					// Edge case values
					empty_string: "",
					zero: 0,
					negative_number: -42,
					infinity: Infinity,
					negative_infinity: -Infinity,
					// NaN gets serialized to null in JSON
					not_a_number: NaN,
				}

				const testRecord = {
					id: "special-values-test",
					vector: new Array(mockDimension).fill(0.1),
					payload: specialValuesPayload,
				}

				await memoryStore.upsert([testRecord])

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testRecord],
				})
			})

			it("should handle extremely large payload objects", async () => {
				// Test payload size limits
				const largeContent = "a".repeat(10000) // 10KB string
				const manyFields: Record<string, string> = {}
				for (let i = 0; i < 100; i++) {
					manyFields[`dynamic_field_${i}`] = `value_${i}`
				}

				const largePayload = {
					content: largeContent,
					category: "large-data",
					large_object: manyFields,
					repeated_data: new Array(50).fill({
						item_id: "template",
						description: "repeated item for testing payload size",
					}),
				}

				const testRecord = {
					id: "large-payload-test",
					vector: new Array(mockDimension).fill(0.1),
					payload: largePayload,
				}

				await memoryStore.upsert([testRecord])

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
					points: [testRecord],
				})
			})
		})

		describe("Conversation Memory Workspace Isolation", () => {
			/**
			 * Tests for memory-specific collection naming patterns and workspace isolation
			 * Ensures conversation memories are properly isolated between workspaces
			 */
			it("should maintain strict workspace isolation for memory collections", async () => {
				const workspaces = [
					"/workspace/project-a",
					"/workspace/project-b",
					"/workspace/client-x",
					"/workspace/personal",
				]

				const stores: QdrantMemoryStore[] = []
				const expectedCollectionNames: string[] = []

				// Create stores for different workspaces
				for (let i = 0; i < workspaces.length; i++) {
					const workspace = workspaces[i]
					const hash = `${i.toString(16).padStart(2, "0")}${"abcdef".repeat(3)}` // Mock different hex hashes
					mockCreateHashInstance.digest.mockReturnValueOnce(hash)

					const store = new QdrantMemoryStore(workspace, mockQdrantUrl, mockDimension)
					stores.push(store)
					expectedCollectionNames.push(`ws-${hash.substring(0, 16)}-memory`)
				}

				// Verify all collection names are unique and follow memory pattern
				const uniqueNames = new Set(expectedCollectionNames)
				expect(uniqueNames.size).toBe(workspaces.length)

				expectedCollectionNames.forEach((name) => {
					expect(name).toMatch(/^ws-[a-f0-9]{16}-memory$/)
					expect(name).toContain("-memory")
				})

				// Verify each store has correct collection name
				stores.forEach((store, i) => {
					expect(store.collectionName()).toBe(expectedCollectionNames[i])
				})
			})

			it("should generate consistent collection names for same workspace", async () => {
				const workspace = "/consistent/workspace/path"
				const consistentHash = "abcdef0123456789abcdef0123456789abcdef01"

				// Mock same hash for same workspace
				mockCreateHashInstance.digest
					.mockReturnValueOnce(consistentHash)
					.mockReturnValueOnce(consistentHash)
					.mockReturnValueOnce(consistentHash)

				const store1 = new QdrantMemoryStore(workspace, mockQdrantUrl, mockDimension)
				const store2 = new QdrantMemoryStore(workspace, "http://different-url", mockDimension)
				const store3 = new QdrantMemoryStore(workspace, mockQdrantUrl, 768) // Different dimension

				const expectedName = `ws-${consistentHash.substring(0, 16)}-memory`

				expect(store1.collectionName()).toBe(expectedName)
				expect(store2.collectionName()).toBe(expectedName)
				expect(store3.collectionName()).toBe(expectedName)
			})

			it("should handle workspace path variations correctly", async () => {
				const workspaceVariations = [
					"/workspace/project",
					"/workspace/project/", // Trailing slash
					"\\workspace\\project", // Windows paths
					"/workspace/../workspace/project", // Path with parent references
					"/workspace/./project", // Path with current directory
					"/workspace/project/../project", // Complex path
				]

				const stores = []
				for (let i = 0; i < workspaceVariations.length; i++) {
					const workspace = workspaceVariations[i]
					const hash = `${i.toString(16).padStart(2, "0")}abcdef${"123456".repeat(2)}`
					mockCreateHashInstance.digest.mockReturnValueOnce(hash)

					const store = new QdrantMemoryStore(workspace, mockQdrantUrl, mockDimension)
					stores.push(store)

					// Verify each variation gets processed independently
					expect(mockCreateHashInstance.update).toHaveBeenLastCalledWith(workspace)
					expect(store.collectionName()).toBe(`ws-${hash.substring(0, 16)}-memory`)
				}
			})

			it("should ensure memory collections are distinct from code-index collections", async () => {
				const workspace = "/shared/workspace"
				const hash = "shared123456789abcdef0123456789abcdef"
				mockCreateHashInstance.digest.mockReturnValue(hash)

				const memoryStore = new QdrantMemoryStore(workspace, mockQdrantUrl, mockDimension)

				// Memory collection should have -memory suffix
				const memoryCollectionName = memoryStore.collectionName()
				expect(memoryCollectionName).toBe(`ws-${hash.substring(0, 16)}-memory`)
				expect(memoryCollectionName).toContain("-memory")

				// Verify it would be different from a hypothetical code-index collection
				const hypotheticalCodeIndexName = `ws-${hash.substring(0, 16)}`
				expect(memoryCollectionName).not.toBe(hypotheticalCodeIndexName)
			})

			it("should handle special characters in workspace paths", async () => {
				const specialWorkspaces = [
					"/workspace/my project with spaces",
					"/workspace/project@company.com",
					"/workspace/project#1-test",
					"/workspace/project$version",
					"/workspace/project%encoded",
					"/workspace/project&more",
					"/workspace/project[brackets]",
					"/workspace/project{braces}",
					"/workspace/project(parens)",
				]

				for (let i = 0; i < specialWorkspaces.length; i++) {
					const workspace = specialWorkspaces[i]
					const hash = `${i.toString(16).padStart(2, "0")}fedcba${"9876543210".substring(0, 8)}`
					mockCreateHashInstance.digest.mockReturnValueOnce(hash)

					const store = new QdrantMemoryStore(workspace, mockQdrantUrl, mockDimension)

					expect(mockCreateHashInstance.update).toHaveBeenLastCalledWith(workspace)
					expect(store.collectionName()).toBe(`ws-${hash.substring(0, 16)}-memory`)
				}
			})

			it("should handle workspace isolation during memory operations", async () => {
				// Create two stores for different workspaces
				const workspace1Hash = "01abcdef23456789abcdef0123456789abcdef01"
				const workspace2Hash = "02fedcba87654321fedcba9876543210fedcba98"

				mockCreateHashInstance.digest.mockReturnValueOnce(workspace1Hash).mockReturnValueOnce(workspace2Hash)

				const store1 = new QdrantMemoryStore("/workspace1", mockQdrantUrl, mockDimension)
				const store2 = new QdrantMemoryStore("/workspace2", mockQdrantUrl, mockDimension)

				const collection1 = `ws-${workspace1Hash.substring(0, 16)}-memory`
				const collection2 = `ws-${workspace2Hash.substring(0, 16)}-memory`

				// Memory operations should use correct collection names
				const memory1 = {
					id: "memory-1",
					vector: new Array(mockDimension).fill(0.1),
					payload: { content: "Workspace 1 memory", workspace: "/workspace1" },
				}

				const memory2 = {
					id: "memory-2",
					vector: new Array(mockDimension).fill(0.2),
					payload: { content: "Workspace 2 memory", workspace: "/workspace2" },
				}

				await store1.upsert([memory1])
				await store2.upsert([memory2])

				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(collection1, { points: [memory1] })
				expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(collection2, { points: [memory2] })

				// Verify collections are different
				expect(collection1).not.toBe(collection2)
				expect(collection1).toContain("-memory")
				expect(collection2).toContain("-memory")
			})
		})

		describe("Advanced Memory Filtering Scenarios", () => {
			/**
			 * Tests for complex filter combinations specific to conversation data
			 * These scenarios test real-world memory retrieval patterns
			 */
			it("should filter conversation memories by time ranges", async () => {
				const timeRangeFilters = {
					category: "conversation",
					timestamp_start: 1640995200000, // Jan 1, 2022
					timestamp_end: 1641081600000, // Jan 2, 2022
					userId: "user123",
				}

				const timeBasedResults = {
					points: [
						{
							id: "time-1",
							payload: {
								content: "Morning conversation about auth",
								category: "conversation",
								userId: "user123",
								timestamp: 1640995800000, // Within range
							},
						},
						{
							id: "time-2",
							payload: {
								content: "Afternoon discussion on APIs",
								category: "conversation",
								userId: "user123",
								timestamp: 1641000000000, // Within range
							},
						},
					],
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(timeBasedResults)

				const result = await memoryStore.filter(50, timeRangeFilters)

				expect(mockQdrantClientInstance.scroll).toHaveBeenCalledWith(expectedCollectionName, {
					limit: 50,
					filter: {
						must: [
							{ key: "category", match: { value: "conversation" } },
							{ key: "timestamp_start", match: { value: 1640995200000 } },
							{ key: "timestamp_end", match: { value: 1641081600000 } },
							{ key: "userId", match: { value: "user123" } },
						],
					},
					with_payload: true,
					with_vector: false,
				})

				expect(result.records).toHaveLength(2)
				expect(result.records[0].payload.timestamp).toBe(1640995800000)
			})

			it("should filter by conversation context and session data", async () => {
				const contextFilters = {
					category: "conversation",
					sessionId: "session-abc-123",
					topic: "react-development",
					context_type: "code_discussion",
				}

				const contextResults = {
					points: [
						{
							id: "context-1",
							payload: {
								content: "Discussion about React hooks lifecycle",
								category: "conversation",
								sessionId: "session-abc-123",
								topic: "react-development",
								context_type: "code_discussion",
								participants: ["user", "assistant"],
							},
						},
					],
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(contextResults)

				const result = await memoryStore.filter(20, contextFilters)

				expect(result.records).toHaveLength(1)
				expect(result.records[0].payload.sessionId).toBe("session-abc-123")
				expect(result.records[0].payload.topic).toBe("react-development")
			})

			it("should filter by debugging and resolution status", async () => {
				const debugFilters = {
					category: "debugging",
					severity: "high",
					resolved: false,
					assigned_to: "developer123",
				}

				const debugResults = {
					points: [
						{
							id: "bug-1",
							payload: {
								content: "Critical memory leak in component lifecycle",
								category: "debugging",
								severity: "high",
								resolved: false,
								assigned_to: "developer123",
								created_date: "2024-01-15",
								affected_files: ["/src/components/DataTable.tsx"],
							},
						},
						{
							id: "bug-2",
							payload: {
								content: "Performance degradation in large datasets",
								category: "debugging",
								severity: "high",
								resolved: false,
								assigned_to: "developer123",
								created_date: "2024-01-16",
								affected_files: ["/src/utils/dataProcessor.js"],
							},
						},
					],
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(debugResults)

				const result = await memoryStore.filter(25, debugFilters)

				expect(result.records).toHaveLength(2)
				expect(result.records.every((r) => r.payload.severity === "high")).toBe(true)
				expect(result.records.every((r) => r.payload.resolved === false)).toBe(true)
			})

			it("should filter by code patterns and confidence scores", async () => {
				const patternFilters = {
					category: "pattern",
					confidence_min: 0.8,
					pattern_type: "authentication",
					language: "typescript",
				}

				const patternResults = {
					points: [
						{
							id: "pattern-1",
							payload: {
								content: "JWT authentication middleware pattern",
								category: "pattern",
								confidence: 0.95,
								pattern_type: "authentication",
								language: "typescript",
								file_path: "/src/middleware/auth.ts",
								usage_count: 12,
							},
						},
						{
							id: "pattern-2",
							payload: {
								content: "OAuth2 integration pattern",
								category: "pattern",
								confidence: 0.87,
								pattern_type: "authentication",
								language: "typescript",
								file_path: "/src/auth/oauth.ts",
								usage_count: 8,
							},
						},
					],
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(patternResults)

				const result = await memoryStore.filter(30, patternFilters)

				expect(result.records).toHaveLength(2)
				expect(result.records[0].payload.confidence).toBeGreaterThan(0.8)
				expect(result.records[0].payload.pattern_type).toBe("authentication")
			})

			it("should handle multi-workspace filtering scenarios", async () => {
				const multiWorkspaceFilters = {
					category: "learning",
					shared: true,
					workspace_type: "team",
					visibility: "public",
				}

				const multiWorkspaceResults = {
					points: [
						{
							id: "shared-1",
							payload: {
								content: "Best practices for React testing",
								category: "learning",
								shared: true,
								workspace_type: "team",
								visibility: "public",
								contributors: ["dev1", "dev2", "dev3"],
								tags: ["testing", "react", "best-practices"],
							},
						},
					],
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(multiWorkspaceResults)

				const result = await memoryStore.filter(40, multiWorkspaceFilters)

				expect(result.records).toHaveLength(1)
				expect(result.records[0].payload.shared).toBe(true)
				expect(result.records[0].payload.visibility).toBe("public")
			})

			it("should filter by user-specific preferences and customizations", async () => {
				const userFilters = {
					userId: "user456",
					user_preference_theme: "dark",
					user_language: "typescript",
					user_experience_level: "intermediate",
				}

				const userResults = {
					points: [
						{
							id: "user-pref-1",
							payload: {
								content: "User prefers dark theme TypeScript examples",
								userId: "user456",
								user_preference_theme: "dark",
								user_language: "typescript",
								user_experience_level: "intermediate",
								personalization_score: 0.9,
							},
						},
					],
				}

				mockQdrantClientInstance.scroll.mockResolvedValue(userResults)

				const result = await memoryStore.filter(15, userFilters)

				expect(result.records).toHaveLength(1)
				expect(result.records[0].payload.userId).toBe("user456")
				expect(result.records[0].payload.user_language).toBe("typescript")
			})

			it("should combine search and filter operations for complex queries", async () => {
				// Test combining vector search with specific filtering
				const searchEmbedding = new Array(mockDimension).fill(0.1)
				const searchFilters = {
					category: "conversation",
					userId: "user789",
					relevance_score_min: 0.7,
				}

				const combinedResults = {
					points: [
						{
							id: "combined-1",
							score: 0.92,
							payload: {
								content: "User question about React performance optimization",
								category: "conversation",
								userId: "user789",
								relevance_score: 0.89,
								context: "performance_discussion",
							},
						},
					],
				}

				mockQdrantClientInstance.query.mockResolvedValue(combinedResults)

				const searchResult = await memoryStore.search(
					"performance optimization",
					searchEmbedding,
					10,
					searchFilters,
				)

				expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(expectedCollectionName, {
					query: searchEmbedding,
					limit: 10,
					filter: {
						must: [
							{ key: "category", match: { value: "conversation" } },
							{ key: "userId", match: { value: "user789" } },
							{ key: "relevance_score_min", match: { value: 0.7 } },
						],
					},
					with_payload: true,
					with_vector: false,
				})

				expect(searchResult).toHaveLength(1)
				expect(searchResult[0].score).toBe(0.92)
				expect(searchResult[0].payload.userId).toBe("user789")

				// Then use filter for pagination
				const filterResult = await memoryStore.filter(10, searchFilters)
				expect(mockQdrantClientInstance.scroll).toHaveBeenCalledWith(expectedCollectionName, {
					limit: 10,
					filter: {
						must: [
							{ key: "category", match: { value: "conversation" } },
							{ key: "userId", match: { value: "user789" } },
							{ key: "relevance_score_min", match: { value: 0.7 } },
						],
					},
					with_payload: true,
					with_vector: false,
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

		describe("Comprehensive Error Handling and Recovery", () => {
			/**
			 * Phase 3: Comprehensive error handling tests adapted from code-index implementation
			 * These tests cover network errors, client errors, graceful degradation, input validation,
			 * and collection operation errors specific to memory operations
			 */

			describe("Network Error Recovery", () => {
				/**
				 * Tests for network connectivity issues, timeouts, and connection failures
				 * Adapted from code-index network error patterns
				 */
				it("should handle connection timeout errors during upsert", async () => {
					const timeoutError = new Error("Connection timeout")
					timeoutError.name = "TimeoutError"
					mockQdrantClientInstance.upsert.mockRejectedValue(timeoutError)

					const testRecord = {
						id: "timeout-test",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Timeout test fact" },
					}

					await expect(memoryStore.upsert([testRecord])).rejects.toThrow("Connection timeout")
					expect(mockQdrantClientInstance.upsert).toHaveBeenCalledWith(expectedCollectionName, {
						points: [testRecord],
					})
				})

				it("should handle network connectivity errors during search operations", async () => {
					const networkError = new Error("Network unreachable")
					networkError.name = "NetworkError"
					mockQdrantClientInstance.query.mockRejectedValue(networkError)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("network test", correctEmbedding, 5)

					// Should return empty array for graceful degradation
					expect(results).toEqual([])
					expect(mockQdrantClientInstance.query).toHaveBeenCalledTimes(1)
				})

				it("should handle DNS resolution failures", async () => {
					const dnsError = new Error("getaddrinfo ENOTFOUND")
					dnsError.name = "DNSError"
					mockQdrantClientInstance.upsert.mockRejectedValue(dnsError)

					const testRecord = {
						id: "dns-test",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "DNS test fact" },
					}

					await expect(memoryStore.upsert([testRecord])).rejects.toThrow("getaddrinfo ENOTFOUND")
				})

				it("should handle connection refused errors", async () => {
					const connectionError = new Error("connect ECONNREFUSED")
					connectionError.name = "ConnectionError"
					mockQdrantClientInstance.query.mockRejectedValue(connectionError)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("connection test", correctEmbedding, 5)

					// Should gracefully degrade for search operations
					expect(results).toEqual([])
				})

				it("should handle SSL/TLS certificate errors", async () => {
					const sslError = new Error("certificate verify failed")
					sslError.name = "SSLError"
					mockQdrantClientInstance.delete.mockRejectedValue(sslError)

					await expect(memoryStore.delete("ssl-test-id")).rejects.toThrow("certificate verify failed")
				})
			})

			describe("Qdrant Client Error Propagation", () => {
				/**
				 * Tests for various Qdrant API errors, malformed responses, and service issues
				 * Adapted from code-index client error handling patterns
				 */
				it("should handle Qdrant API errors during upsert operations", async () => {
					const apiError = new Error("Bad Request: Invalid vector dimension")
					apiError.name = "QdrantAPIError"
					mockQdrantClientInstance.upsert.mockRejectedValue(apiError)

					const testRecord = {
						id: "api-error-test",
						vector: [0.1, 0.2], // Wrong dimension
						payload: { content: "API error test" },
					}

					await expect(memoryStore.upsert([testRecord])).rejects.toThrow(
						"Bad Request: Invalid vector dimension",
					)
				})

				it("should handle service unavailable errors", async () => {
					const serviceError = new Error("Service Temporarily Unavailable")
					serviceError.name = "ServiceUnavailableError"
					mockQdrantClientInstance.retrieve.mockRejectedValue(serviceError)

					await expect(memoryStore.get("unavailable-test")).rejects.toThrow("Service Temporarily Unavailable")
				})

				it("should handle malformed JSON responses", async () => {
					const jsonError = new Error("Unexpected token in JSON")
					jsonError.name = "SyntaxError"
					mockQdrantClientInstance.query.mockRejectedValue(jsonError)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("json error test", correctEmbedding, 5)

					// Should gracefully degrade for search
					expect(results).toEqual([])
				})

				it("should handle rate limiting errors", async () => {
					const rateLimitError = new Error("Rate limit exceeded")
					rateLimitError.name = "RateLimitError"
					mockQdrantClientInstance.upsert.mockRejectedValue(rateLimitError)

					const testRecord = {
						id: "rate-limit-test",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Rate limit test" },
					}

					await expect(memoryStore.upsert([testRecord])).rejects.toThrow("Rate limit exceeded")
				})

				it("should handle authentication errors", async () => {
					const authError = new Error("Unauthorized: Invalid API key")
					authError.name = "AuthenticationError"
					mockQdrantClientInstance.query.mockRejectedValue(authError)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("auth test", correctEmbedding, 5)

					// Should gracefully degrade for search
					expect(results).toEqual([])
				})

				it("should handle malformed search response structures", async () => {
					// Mock completely malformed response
					mockQdrantClientInstance.query.mockResolvedValue({
						// Missing points array
						invalid_field: "unexpected_data",
					})

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("malformed test", correctEmbedding, 5)

					// Should handle gracefully
					expect(results).toEqual([])
				})

				it("should handle null responses from Qdrant client", async () => {
					mockQdrantClientInstance.query.mockResolvedValue(null)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("null response test", correctEmbedding, 5)

					expect(results).toEqual([])
				})

				it("should handle undefined responses from Qdrant client", async () => {
					mockQdrantClientInstance.query.mockResolvedValue(undefined)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("undefined response test", correctEmbedding, 5)

					expect(results).toEqual([])
				})
			})

			describe("Graceful Degradation", () => {
				/**
				 * Tests for handling partial failures and implementing fallback behaviors
				 * Ensuring system remains functional even when some operations fail
				 */
				it("should handle partial search result corruption gracefully", async () => {
					const mixedResults = {
						points: [
							{
								id: "valid-result",
								score: 0.85,
								payload: { content: "Valid memory fact", category: "architecture" },
							},
							{
								id: "corrupted-result-1",
								score: "invalid-score", // Invalid score type
								payload: null,
							},
							{
								id: "valid-result-2",
								score: 0.75,
								payload: { content: "Another valid fact", category: "debugging" },
							},
							{
								id: "corrupted-result-2",
								// Missing score and payload
							},
						],
					}

					mockQdrantClientInstance.query.mockResolvedValue(mixedResults)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("mixed results test", correctEmbedding, 10)

					// Should process all results, returning what's available for each
					expect(results).toHaveLength(4)
					expect(results[0]).toEqual({
						id: "valid-result",
						vector: [],
						payload: { content: "Valid memory fact", category: "architecture" },
						score: 0.85,
					})
					expect(results[1]).toEqual({
						id: "corrupted-result-1",
						vector: [],
						payload: null,
						score: "invalid-score", // Preserves original data
					})
					expect(results[3]).toEqual({
						id: "corrupted-result-2",
						vector: [],
						payload: undefined,
						score: undefined,
					})
				})

				it("should handle memory operations when storage is partially degraded", async () => {
					// Simulate scenario where get operations fail but search still works
					mockQdrantClientInstance.retrieve.mockRejectedValue(new Error("Storage degraded"))
					mockQdrantClientInstance.query.mockResolvedValue({ points: [] })

					// Get should fail
					await expect(memoryStore.get("degraded-test")).rejects.toThrow("Storage degraded")

					// But search should still work gracefully
					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("degraded search", correctEmbedding, 5)
					expect(results).toEqual([])
				})

				it("should handle filter operations when scroll API is degraded", async () => {
					const scrollError = new Error("Scroll API temporarily unavailable")
					mockQdrantClientInstance.scroll.mockRejectedValue(scrollError)

					await expect(memoryStore.filter(10, { category: "test" })).rejects.toThrow(
						"Scroll API temporarily unavailable",
					)
				})

				it("should handle update operations with partial failure scenarios", async () => {
					// Simulate payload update succeeding but vector update failing
					mockQdrantClientInstance.setPayload.mockResolvedValue({} as any)
					mockQdrantClientInstance.updateVectors.mockRejectedValue(new Error("Vector update failed"))

					const testId = "partial-update-test"
					const newVector = [0.7, 0.8, 0.9]
					const newPayload = { content: "Updated content", resolved: true }

					// Should propagate the vector update error
					await expect(memoryStore.update(testId, newVector, newPayload)).rejects.toThrow(
						"Vector update failed",
					)

					// Verify payload update was attempted first
					expect(mockQdrantClientInstance.setPayload).toHaveBeenCalledWith(expectedCollectionName, {
						points: [testId],
						payload: newPayload,
					})
				})
			})

			describe("Input Validation Errors", () => {
				/**
				 * Tests for invalid parameters, malformed data, and edge case handling
				 * Ensuring robust input validation for memory operations
				 */
				it("should handle empty or invalid vector arrays in insert operations", async () => {
					// Test with various invalid vector inputs
					const invalidVectors = [
						[], // Empty vector - this one should be filtered out
						[NaN, 0.2, 0.3], // Contains NaN - passed through to Qdrant
						[Infinity, 0.2, 0.3], // Contains Infinity - passed through to Qdrant
						[-Infinity, 0.2, 0.3], // Contains -Infinity - passed through to Qdrant
						[0.1, undefined, 0.3], // Contains undefined - passed through to Qdrant
						[0.1, null, 0.3], // Contains null - passed through to Qdrant
					]

					let callCount = 0
					for (const invalidVector of invalidVectors) {
						const ids = ["invalid-vector-test"]
						const payloads = [{ content: "Invalid vector test" }]

						await memoryStore.insert([invalidVector as any], ids, payloads)

						// Empty vectors are filtered out, others are passed through
						if (invalidVector.length > 0) {
							callCount++
							expect(mockQdrantClientInstance.upsert).toHaveBeenLastCalledWith(expectedCollectionName, {
								points: [
									{
										id: "invalid-vector-test",
										vector: invalidVector,
										payload: { content: "Invalid vector test" },
									},
								],
							})
						}
					}

					// Should have called upsert 5 times (all except empty vector)
					expect(mockQdrantClientInstance.upsert).toHaveBeenCalledTimes(callCount)
				})

				it("should handle malformed payload structures", async () => {
					const malformedPayloads = [
						null,
						undefined,
						"invalid-payload-string", // Should be object
						42, // Should be object
						[], // Should be object, not array
					]

					for (const payload of malformedPayloads) {
						const testRecord = {
							id: `malformed-payload-${typeof payload}`,
							vector: [0.1, 0.2, 0.3],
							payload: payload as any,
						}

						// Should still call upsert (validation is handled by Qdrant)
						await memoryStore.upsert([testRecord])
						expect(mockQdrantClientInstance.upsert).toHaveBeenLastCalledWith(expectedCollectionName, {
							points: [testRecord],
						})
					}
				})

				it("should handle invalid ID formats", async () => {
					const invalidIds = [
						null,
						undefined,
						"", // Empty string
						"   ", // Whitespace only
						"id/with/slashes",
						"id with spaces",
						"id@with#special$chars%",
						42, // Numeric ID
						{}, // Object ID
					]

					for (const invalidId of invalidIds) {
						const testRecord = {
							id: invalidId as any,
							vector: [0.1, 0.2, 0.3],
							payload: { content: "Invalid ID test" },
						}

						// Should still call upsert (ID validation handled by Qdrant)
						await memoryStore.upsert([testRecord])
						expect(mockQdrantClientInstance.upsert).toHaveBeenLastCalledWith(expectedCollectionName, {
							points: [testRecord],
						})
					}
				})

				it("should handle extreme filter values", async () => {
					const extremeFilters = {
						category: "", // Empty string
						resolved: null, // Null value - actually included in implementation
						priority: Infinity, // Infinite number
						confidence: -1, // Negative confidence
						workspace_path: "a".repeat(1000), // Very long string
					}

					mockQdrantClientInstance.query.mockResolvedValue({ points: [] })

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("extreme filter test", correctEmbedding, 5, extremeFilters)

					// Should handle gracefully - implementation includes null values
					expect(results).toEqual([])
					expect(mockQdrantClientInstance.query).toHaveBeenCalledWith(
						expectedCollectionName,
						expect.objectContaining({
							filter: {
								must: [
									{ key: "category", match: { value: "" } },
									{ key: "resolved", match: { value: null } }, // null values are included
									{ key: "priority", match: { value: Infinity } },
									{ key: "confidence", match: { value: -1 } },
									{ key: "workspace_path", match: { value: "a".repeat(1000) } },
								],
							},
						}),
					)
				})

				it("should handle dimension mismatch in search operations", async () => {
					const wrongDimensionEmbeddings = [
						[], // Empty
						[0.1], // Too small
						new Array(mockDimension + 100).fill(0.1), // Too large
						new Array(mockDimension / 2).fill(0.1), // Half size
					]

					for (const embedding of wrongDimensionEmbeddings) {
						const results = await memoryStore.search("dimension test", embedding, 5)

						// Should return empty array without calling query
						expect(results).toEqual([])
					}

					// Should never call query for wrong dimensions
					expect(mockQdrantClientInstance.query).not.toHaveBeenCalled()
				})
			})

			describe("Collection Operation Errors", () => {
				/**
				 * Tests for collection-specific errors: not found, permissions, resource constraints
				 * Adapted from code-index collection management error patterns
				 */
				it("should handle collection not found errors", async () => {
					const collectionError = new Error("Collection not found")
					collectionError.name = "CollectionNotFoundError"
					mockQdrantClientInstance.query.mockRejectedValue(collectionError)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("collection missing test", correctEmbedding, 5)

					// Should gracefully degrade for search
					expect(results).toEqual([])
				})

				it("should handle collection permission errors", async () => {
					const permissionError = new Error("Insufficient permissions to access collection")
					permissionError.name = "PermissionError"
					mockQdrantClientInstance.upsert.mockRejectedValue(permissionError)

					const testRecord = {
						id: "permission-test",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Permission test" },
					}

					await expect(memoryStore.upsert([testRecord])).rejects.toThrow(
						"Insufficient permissions to access collection",
					)
				})

				it("should handle storage quota exceeded errors", async () => {
					const quotaError = new Error("Storage quota exceeded")
					quotaError.name = "QuotaExceededError"
					mockQdrantClientInstance.upsert.mockRejectedValue(quotaError)

					const testRecord = {
						id: "quota-test",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Quota test" },
					}

					await expect(memoryStore.upsert([testRecord])).rejects.toThrow("Storage quota exceeded")
				})

				it("should handle collection deletion errors", async () => {
					const deletionError = new Error("Failed to delete collection")
					deletionError.name = "CollectionDeletionError"
					mockQdrantClientInstance.deleteCollection.mockRejectedValue(deletionError)

					await expect(memoryStore.deleteCollection()).rejects.toThrow("Failed to delete collection")
				})

				it("should handle collection clearing errors", async () => {
					const clearError = new Error("Failed to clear collection")
					clearError.name = "CollectionClearError"
					mockQdrantClientInstance.delete.mockRejectedValue(clearError)

					await expect(memoryStore.clearCollection()).rejects.toThrow("Failed to clear collection")
				})

				it("should handle ensureCollection errors during initialization", async () => {
					const initError = new Error("Failed to initialize collection")
					initError.name = "CollectionInitError"
					vi.mocked(ensureCollection).mockRejectedValue(initError)

					await expect(memoryStore.ensureCollection("test-collection", 1536)).rejects.toThrow(
						"Failed to initialize collection",
					)
				})

				it("should handle concurrent collection access errors", async () => {
					const concurrencyError = new Error("Collection locked by another operation")
					concurrencyError.name = "ConcurrencyError"
					mockQdrantClientInstance.upsert.mockRejectedValue(concurrencyError)

					const testRecord = {
						id: "concurrency-test",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Concurrency test" },
					}

					await expect(memoryStore.upsert([testRecord])).rejects.toThrow(
						"Collection locked by another operation",
					)
				})

				it("should handle index corruption errors", async () => {
					const corruptionError = new Error("Vector index corrupted")
					corruptionError.name = "IndexCorruptionError"
					mockQdrantClientInstance.query.mockRejectedValue(corruptionError)

					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("corruption test", correctEmbedding, 5)

					// Should gracefully degrade
					expect(results).toEqual([])
				})
			})

			describe("Legacy Error Handling Tests", () => {
				/**
				 * Preserving existing error handling tests to maintain compatibility
				 */
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

				it("should return empty array on search errors instead of throwing", async () => {
					const searchError = new Error("Search index not ready")
					mockQdrantClientInstance.query.mockRejectedValue(searchError)

					// Create embedding with correct dimension
					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("test", correctEmbedding, 5)

					// Should return empty array instead of throwing
					expect(results).toEqual([])
				})

				it("should handle malformed search results", async () => {
					// Mock malformed response
					mockQdrantClientInstance.query.mockResolvedValue({
						points: [
							{ id: "malformed-1" }, // Missing expected fields
							{ id: "malformed-2", score: 0.5 }, // Missing payload
						],
					})

					// Create embedding with correct dimension
					const correctEmbedding = new Array(mockDimension).fill(0.1)
					const results = await memoryStore.search("test", correctEmbedding, 5)

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
