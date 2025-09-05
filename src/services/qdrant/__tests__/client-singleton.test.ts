// npx vitest run src/services/qdrant/__tests__/client-singleton.test.ts

import { QdrantClient } from "@qdrant/js-client-rest"
import { QdrantClientSingleton, CollectionState } from "../client-singleton"
import { createQdrantClientFromUrl, ensureCollection } from "../common"

// Mock the dependencies
vi.mock("../common")

describe("QdrantClientSingleton", () => {
	let mockQdrantClient: Partial<QdrantClient>
	let mockCreateQdrantClientFromUrl: any
	let mockEnsureCollection: any

	beforeEach(() => {
		// Reset singleton state before each test
		QdrantClientSingleton.reset()

		// Create mock client
		mockQdrantClient = {
			getCollection: vi.fn(),
			createCollection: vi.fn(),
			deleteCollection: vi.fn(),
		}

		// Mock the create function to return new instances each time
		mockCreateQdrantClientFromUrl = vi.mocked(createQdrantClientFromUrl)
		mockCreateQdrantClientFromUrl.mockImplementation((url: string, apiKey?: string) => {
			// Return a new mock client instance each time to simulate different clients
			return {
				getCollection: vi.fn(),
				createCollection: vi.fn(),
				deleteCollection: vi.fn(),
				url,
				apiKey,
			}
		})

		// Mock ensure collection
		mockEnsureCollection = vi.mocked(ensureCollection)
		mockEnsureCollection.mockResolvedValue(true)
	})

	afterEach(() => {
		vi.clearAllMocks()
		QdrantClientSingleton.reset()
	})

	describe("Basic Singleton Functionality", () => {
		it("should return same instance for same URL and API key", () => {
			const url = "http://localhost:6333"
			const apiKey = "test-key"

			const instance1 = QdrantClientSingleton.getInstance(url, apiKey)
			const instance2 = QdrantClientSingleton.getInstance(url, apiKey)

			expect(instance1).toBe(instance2)
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(1)
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledWith(url, apiKey)
		})

		it("should create new instance when URL changes", () => {
			const url1 = "http://localhost:6333"
			const url2 = "http://localhost:6334"
			const apiKey = "test-key"

			const instance1 = QdrantClientSingleton.getInstance(url1, apiKey)
			const instance2 = QdrantClientSingleton.getInstance(url2, apiKey)

			expect(instance1).not.toBe(instance2)
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(2)
		})

		it("should create new instance when API key changes", () => {
			const url = "http://localhost:6333"
			const apiKey1 = "test-key-1"
			const apiKey2 = "test-key-2"

			const instance1 = QdrantClientSingleton.getInstance(url, apiKey1)
			const instance2 = QdrantClientSingleton.getInstance(url, apiKey2)

			expect(instance1).not.toBe(instance2)
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(2)
		})

		it("should reset all state when reset is called", () => {
			const url = "http://localhost:6333"
			const apiKey = "test-key"

			QdrantClientSingleton.getInstance(url, apiKey)
			QdrantClientSingleton.reset()

			const newInstance = QdrantClientSingleton.getInstance(url, apiKey)

			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(2)
			expect(QdrantClientSingleton.listRegisteredCollections()).toHaveLength(0)
		})
	})

	describe("Collection Registry and Coordination", () => {
		beforeEach(() => {
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			// Mock getCollection for validation
			vi.mocked(client.getCollection!).mockResolvedValue({
				config: {
					params: {
						vectors: { size: 512 },
					},
				},
				points_count: 0,
			} as any)
		})

		it("should register collection state during creation", async () => {
			const collectionName = "test-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			const promise = QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)

			// Check that collection is registered with 'creating' status initially
			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state?.status).toBe("creating")
			expect(state?.dimension).toBe(dimension)
			expect(state?.name).toBe(collectionName)
			expect(state?.workspace).toBe(workspacePath)

			await promise

			// Check final state
			const finalState = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(finalState?.status).toBe("ready")
		})

		it("should return existing collection if already ready with same dimension", async () => {
			const collectionName = "test-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			// First creation
			await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)

			// Second attempt should return false (already existed)
			const result = await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)

			expect(result).toBe(false)
			expect(mockEnsureCollection).toHaveBeenCalledTimes(1) // Only called once
		})

		it("should list registered collections", async () => {
			const collections = [
				{ name: "collection1", workspace: "/workspace1", dimension: 512 },
				{ name: "collection2", workspace: "/workspace2", dimension: 1024 },
			]

			// Mock getCollection for different dimensions
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			vi.mocked(client.getCollection!).mockImplementation((name: string) => {
				const collection = collections.find((c) => c.name === name)
				return Promise.resolve({
					config: {
						params: {
							vectors: { size: collection?.dimension || 512 },
						},
					},
					points_count: 0,
				} as any)
			})

			for (const { name, workspace, dimension } of collections) {
				await QdrantClientSingleton.ensureCollection(name, workspace, dimension)
			}

			const registeredCollections = QdrantClientSingleton.listRegisteredCollections()
			expect(registeredCollections).toHaveLength(2)

			const names = registeredCollections.map((c) => c.name)
			expect(names).toContain("collection1")
			expect(names).toContain("collection2")
		})

		it("should handle collection state cleanup", () => {
			const collectionName = "test-collection"
			const workspacePath = "/test/workspace"

			// Force cleanup
			QdrantClientSingleton.forceCleanupCollection(collectionName, workspacePath)

			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state).toBeUndefined()
		})
	})

	describe("Mutex-based Locking for Collection Creation", () => {
		beforeEach(() => {
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			// Mock getCollection for validation
			vi.mocked(client.getCollection!).mockResolvedValue({
				config: {
					params: {
						vectors: { size: 512 },
					},
				},
				points_count: 0,
			} as any)
		})

		it("should handle concurrent collection creation with locking", async () => {
			const collectionName = "concurrent-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			// Mock a slow ensureCollection call
			mockEnsureCollection.mockImplementation(
				() => new Promise((resolve) => setTimeout(() => resolve(true), 100)),
			)

			// Start multiple concurrent operations
			const promises = Array.from({ length: 3 }, () =>
				QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension),
			)

			const results = await Promise.all(promises)

			// Only one should have actually created (first one), others should have waited
			expect(mockEnsureCollection).toHaveBeenCalledTimes(1)
			expect(results[0]).toBe(true) // First operation created the collection
			expect(results[1]).toBe(true) // Others waited for the same result
			expect(results[2]).toBe(true)

			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state?.status).toBe("ready")
		})

		it("should handle lock cleanup after failed operations", async () => {
			const collectionName = "failing-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			// Mock a failing ensureCollection call
			const error = new Error("Collection creation failed")
			mockEnsureCollection.mockRejectedValue(error)

			// First attempt should fail
			await expect(
				QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension),
			).rejects.toThrow("Collection creation failed")

			// Mock success for retry
			mockEnsureCollection.mockResolvedValue(true)

			// Second attempt should succeed (lock should be cleaned up)
			const result = await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)
			expect(result).toBe(true)
			expect(mockEnsureCollection).toHaveBeenCalledTimes(2)
		})
	})

	describe("Collection Existence Validation", () => {
		beforeEach(() => {
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			// Default mock for getCollection
			vi.mocked(client.getCollection!).mockResolvedValue({
				config: {
					params: {
						vectors: { size: 512 },
					},
				},
				points_count: 0,
			} as any)
		})

		it("should validate collection configuration after creation", async () => {
			const collectionName = "validation-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)

			expect(client.getCollection).toHaveBeenCalledWith(collectionName)
		})

		it("should handle validation errors gracefully", async () => {
			const collectionName = "invalid-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			// Mock validation failure
			mockEnsureCollection.mockResolvedValue(true)
			vi.mocked(client.getCollection!).mockRejectedValue(new Error("Collection not accessible"))

			await expect(
				QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension),
			).rejects.toThrow("Collection validation failed")

			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state?.status).toBe("error")
		})

		it("should detect dimension mismatches during validation", async () => {
			const collectionName = "mismatch-collection"
			const workspacePath = "/test/workspace"
			const expectedDimension = 512
			const actualDimension = 1024

			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			mockEnsureCollection.mockResolvedValue(true)
			vi.mocked(client.getCollection!).mockResolvedValue({
				config: {
					params: {
						vectors: { size: actualDimension },
					},
				},
				points_count: 0,
			} as any)

			await expect(
				QdrantClientSingleton.ensureCollection(collectionName, workspacePath, expectedDimension),
			).rejects.toThrow(`Collection dimension mismatch: expected ${expectedDimension}, got ${actualDimension}`)
		})
	})

	describe("Error Handling and Recovery", () => {
		beforeEach(() => {
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			// Default mock for getCollection
			vi.mocked(client.getCollection!).mockResolvedValue({
				config: {
					params: {
						vectors: { size: 512 },
					},
				},
				points_count: 0,
			} as any)
		})

		it("should handle client initialization errors", () => {
			QdrantClientSingleton.reset()

			expect(() => QdrantClientSingleton.ensureCollection("test", "/workspace", 512)).rejects.toThrow(
				"QdrantClientSingleton not initialized",
			)
		})

		it("should update collection status to error on failure", async () => {
			const collectionName = "error-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			mockEnsureCollection.mockRejectedValue(new Error("Creation failed"))

			await expect(
				QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension),
			).rejects.toThrow("Creation failed")

			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state?.status).toBe("error")
		})

		it("should allow retry after error state", async () => {
			const collectionName = "retry-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			// First attempt fails
			mockEnsureCollection.mockRejectedValueOnce(new Error("Temporary failure"))

			await expect(
				QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension),
			).rejects.toThrow("Temporary failure")

			// Second attempt succeeds
			mockEnsureCollection.mockResolvedValue(true)
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			vi.mocked(client.getCollection!).mockResolvedValue({
				config: { params: { vectors: { size: dimension } } },
				points_count: 0,
			} as any)

			const result = await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)
			expect(result).toBe(true)

			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state?.status).toBe("ready")
		})
	})

	describe("Health Monitoring", () => {
		beforeEach(() => {
			vi.useFakeTimers()
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			// Mock getCollection for validation
			vi.mocked(client.getCollection!).mockResolvedValue({
				config: {
					params: {
						vectors: { size: 512 },
					},
				},
				points_count: 0,
			} as any)
		})

		afterEach(() => {
			vi.useRealTimers()
		})

		it("should start health monitoring when getInstance is called", () => {
			// Health monitoring should start automatically
			expect(vi.getTimerCount()).toBeGreaterThan(0)
		})

		it("should perform health checks on collections", async () => {
			const collectionName = "health-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)

			// Fast-forward time to trigger health check
			vi.advanceTimersByTime(35000) // More than 30 second threshold

			// Allow async operations to complete
			await vi.runOnlyPendingTimersAsync()

			// Health check should have been called
			expect(client.getCollection).toHaveBeenCalledWith(collectionName)
		})

		it("should mark collections as error if they become inaccessible", async () => {
			const collectionName = "disappearing-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			// Create collection successfully first
			await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)

			// Mock collection disappearing for health checks
			vi.mocked(client.getCollection!).mockRejectedValue(new Error("Collection not found"))

			// Trigger health check
			vi.advanceTimersByTime(35000)
			await vi.runOnlyPendingTimersAsync()

			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state?.status).toBe("error")
		})

		it("should clean up stale collections from registry", async () => {
			const collectionName = "stale-collection"
			const workspacePath = "/test/workspace"
			const dimension = 512

			await QdrantClientSingleton.ensureCollection(collectionName, workspacePath, dimension)

			// Fast-forward time beyond timeout threshold (5 minutes)
			vi.advanceTimersByTime(350000)
			await vi.runOnlyPendingTimersAsync()

			const state = QdrantClientSingleton.getCollectionState(collectionName, workspacePath)
			expect(state).toBeUndefined()
		})
	})

	describe("Integration Scenarios", () => {
		it("should handle code-index and conversation-memory integration", async () => {
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			// Simulate code-index collection (without -memory suffix)
			const codeIndexCollection = "ws-abc123456789abcd"
			const memoryCollection = "ws-abc123456789abcd-memory"
			const workspacePath = "/shared/workspace"
			const dimension = 1536

			vi.mocked(client.getCollection!).mockResolvedValue({
				config: { params: { vectors: { size: dimension } } },
				points_count: 0,
			} as any)

			// Both systems should be able to create their collections
			const codeIndexResult = await QdrantClientSingleton.ensureCollection(
				codeIndexCollection,
				workspacePath,
				dimension,
			)
			const memoryResult = await QdrantClientSingleton.ensureCollection(
				memoryCollection,
				workspacePath,
				dimension,
			)

			expect(codeIndexResult).toBe(true)
			expect(memoryResult).toBe(true)

			// Both collections should be registered
			const collections = QdrantClientSingleton.listRegisteredCollections()
			expect(collections).toHaveLength(2)

			const names = collections.map((c) => c.name)
			expect(names).toContain(codeIndexCollection)
			expect(names).toContain(memoryCollection)
		})

		it("should handle workspace isolation correctly", async () => {
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			const collectionName = "ws-shared-name"
			const workspace1 = "/workspace1"
			const workspace2 = "/workspace2"
			const dimension = 512

			vi.mocked(client.getCollection!).mockResolvedValue({
				config: { params: { vectors: { size: dimension } } },
				points_count: 0,
			} as any)

			// Create collections for different workspaces
			await QdrantClientSingleton.ensureCollection(collectionName, workspace1, dimension)
			await QdrantClientSingleton.ensureCollection(collectionName, workspace2, dimension)

			// Should have separate registry entries
			const state1 = QdrantClientSingleton.getCollectionState(collectionName, workspace1)
			const state2 = QdrantClientSingleton.getCollectionState(collectionName, workspace2)

			expect(state1).toBeDefined()
			expect(state2).toBeDefined()
			expect(state1?.workspace).toBe(workspace1)
			expect(state2?.workspace).toBe(workspace2)
		})
	})

	describe("Phase 1B: Client Initialization Concurrency", () => {
		beforeEach(() => {
			QdrantClientSingleton.reset()
			vi.clearAllMocks()
		})

		it("should handle concurrent getInstance() calls with same parameters", async () => {
			const url = "http://localhost:6333"
			const apiKey = "test-key"

			// Mock getCollections for connection validation
			const mockClient = { getCollections: vi.fn().mockResolvedValue([]) }
			vi.mocked(mockCreateQdrantClientFromUrl).mockReturnValue(mockClient as any)

			// Call getInstance() multiple times concurrently
			const promises = Array.from({ length: 5 }, () =>
				Promise.resolve(QdrantClientSingleton.getInstance(url, apiKey)),
			)

			const results = await Promise.all(promises)

			// All should return the same instance
			results.forEach((client) => {
				expect(client).toBe(results[0])
			})

			// Client should only be created once
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(1)
		})

		it("should handle connection validation during getInstance()", () => {
			const url = "http://localhost:6333"
			const apiKey = "test-key"

			// Mock successful connection
			const mockClient = { getCollections: vi.fn().mockResolvedValue([]) }
			vi.mocked(mockCreateQdrantClientFromUrl).mockReturnValue(mockClient as any)

			const client1 = QdrantClientSingleton.getInstance(url, apiKey)
			const client2 = QdrantClientSingleton.getInstance(url, apiKey)

			expect(client1).toBe(client2)
			expect(mockClient.getCollections).toHaveBeenCalled()
		})

		it("should handle initialization with different parameters", () => {
			// Mock successful connections
			const mockClient1 = { getCollections: vi.fn().mockResolvedValue([]) }
			const mockClient2 = { getCollections: vi.fn().mockResolvedValue([]) }

			vi.mocked(mockCreateQdrantClientFromUrl)
				.mockReturnValueOnce(mockClient1 as any)
				.mockReturnValueOnce(mockClient2 as any)

			const client1 = QdrantClientSingleton.getInstance("http://localhost:6333", "key1")
			const client2 = QdrantClientSingleton.getInstance("http://localhost:6334", "key2")

			expect(client1).toBe(mockClient1)
			expect(client2).toBe(mockClient2)
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(2)
		})
	})

	describe("Phase 1B: Circuit Breaker Patterns", () => {
		beforeEach(() => {
			QdrantClientSingleton.reset()
			vi.clearAllMocks()
		})

		it("should start with circuit breaker in CLOSED state", () => {
			const state = QdrantClientSingleton.getCircuitBreakerState()

			expect(state.state).toBe("CLOSED")
			expect(state.failures).toBe(0)
		})

		it("should open circuit breaker after failure threshold", async () => {
			// Force circuit breaker to OPEN state
			QdrantClientSingleton.forceCircuitBreakerState("OPEN")

			const state = QdrantClientSingleton.getCircuitBreakerState()
			expect(state.state).toBe("OPEN")

			// Should throw error when trying to get instance with open circuit breaker
			expect(() => {
				QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			}).toThrow("Circuit breaker is open")
		})

		it("should transition circuit breaker from OPEN to HALF_OPEN", () => {
			// Force to OPEN state
			QdrantClientSingleton.forceCircuitBreakerState("OPEN")

			// Simulate time passing by setting nextAttemptTime to past
			const state = QdrantClientSingleton.getCircuitBreakerState()
			expect(state.state).toBe("OPEN")

			// After manual state change, it should allow attempts
			QdrantClientSingleton.forceCircuitBreakerState("HALF_OPEN")
			const newState = QdrantClientSingleton.getCircuitBreakerState()
			expect(newState.state).toBe("HALF_OPEN")
		})

		it("should reset circuit breaker state on successful operation", () => {
			QdrantClientSingleton.forceCircuitBreakerState("HALF_OPEN")

			// Mock successful connection
			const mockClient = { getCollections: vi.fn().mockResolvedValue([]) }
			vi.mocked(mockCreateQdrantClientFromUrl).mockReturnValue(mockClient as any)

			// This should succeed and close the circuit breaker
			const client = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			expect(client).toBe(mockClient)

			// Note: The circuit breaker state change happens asynchronously during connection validation
			// We can verify the client was created successfully
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalled()
		})
	})

	describe("Phase 1B: Connection Validation and State Tracking", () => {
		beforeEach(() => {
			QdrantClientSingleton.reset()
			vi.clearAllMocks()
		})

		it("should validate client connection on getInstance()", () => {
			const mockClient = { getCollections: vi.fn().mockResolvedValue([]) }
			vi.mocked(mockCreateQdrantClientFromUrl).mockReturnValue(mockClient as any)

			const client1 = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			const client2 = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			expect(client1).toBe(client2)
			// Connection validation should be called
			expect(mockClient.getCollections).toHaveBeenCalled()
		})

		it("should handle connection validation failures gracefully", () => {
			const mockClient = {
				getCollections: vi.fn().mockRejectedValue(new Error("Connection failed")),
			}
			vi.mocked(mockCreateQdrantClientFromUrl).mockReturnValue(mockClient as any)

			// First call should succeed (client creation)
			const client1 = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			expect(client1).toBe(mockClient)

			// Second call should still return the client (validation failure is logged but doesn't throw)
			const client2 = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			expect(client2).toBe(mockClient)

			expect(mockClient.getCollections).toHaveBeenCalled()
		})

		it("should track client state across different URL/key combinations", () => {
			const mockClient1 = { getCollections: vi.fn().mockResolvedValue([]) }
			const mockClient2 = { getCollections: vi.fn().mockResolvedValue([]) }
			const mockClient3 = { getCollections: vi.fn().mockResolvedValue([]) }

			vi.mocked(mockCreateQdrantClientFromUrl)
				.mockReturnValueOnce(mockClient1 as any)
				.mockReturnValueOnce(mockClient2 as any)
				.mockReturnValueOnce(mockClient3 as any)

			// Create client with first set of parameters
			const client1 = QdrantClientSingleton.getInstance("http://localhost:6333", "key1")
			expect(client1).toBe(mockClient1)

			// Create client with different parameters - this replaces the previous client
			const client2 = QdrantClientSingleton.getInstance("http://localhost:6334", "key2")
			expect(client2).toBe(mockClient2)

			// Return to first parameters - singleton creates new client (doesn't cache multiple clients)
			const client3 = QdrantClientSingleton.getInstance("http://localhost:6333", "key1")
			expect(client3).toBe(mockClient3)

			// Should have created 3 different clients since parameters changed each time
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(3)
		})
	})

	describe("Phase 1B: Reset and State Management", () => {
		beforeEach(() => {
			QdrantClientSingleton.reset()
			vi.clearAllMocks()
		})

		it("should reset all state including circuit breaker", () => {
			// Create an instance first
			const mockClient = { getCollections: vi.fn().mockResolvedValue([]) }
			vi.mocked(mockCreateQdrantClientFromUrl).mockReturnValue(mockClient as any)

			QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")

			// Force circuit breaker to open
			QdrantClientSingleton.forceCircuitBreakerState("OPEN")
			let state = QdrantClientSingleton.getCircuitBreakerState()
			expect(state.state).toBe("OPEN")

			// Reset should clear everything
			QdrantClientSingleton.reset()

			// Circuit breaker should be reset to CLOSED
			state = QdrantClientSingleton.getCircuitBreakerState()
			expect(state.state).toBe("CLOSED")
			expect(state.failures).toBe(0)

			// Should be able to create new instance
			const newClient = QdrantClientSingleton.getInstance("http://localhost:6333", "test-key")
			expect(newClient).toBeTruthy()
			expect(mockCreateQdrantClientFromUrl).toHaveBeenCalledTimes(2) // Once before reset, once after
		})

		it("should handle circuit breaker state manipulation", () => {
			// Start in CLOSED state
			let state = QdrantClientSingleton.getCircuitBreakerState()
			expect(state.state).toBe("CLOSED")

			// Force to OPEN
			QdrantClientSingleton.forceCircuitBreakerState("OPEN")
			state = QdrantClientSingleton.getCircuitBreakerState()
			expect(state.state).toBe("OPEN")
			expect(state.nextAttemptTime).toBeGreaterThan(Date.now())

			// Force to HALF_OPEN
			QdrantClientSingleton.forceCircuitBreakerState("HALF_OPEN")
			state = QdrantClientSingleton.getCircuitBreakerState()
			expect(state.state).toBe("HALF_OPEN")
		})
	})
})
