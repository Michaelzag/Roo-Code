import { QdrantClient, Schemas } from "@qdrant/js-client-rest"
import { createQdrantClientFromUrl, ensureCollection, EnsureCollectionOptions } from "./common"

/**
 * Collection state tracking interface
 */
interface CollectionState {
	name: string
	workspace: string
	dimension: number
	status: "creating" | "ready" | "error"
	lastAccessed: number
	createdAt: number
	options?: EnsureCollectionOptions
}

/**
 * Collection creation operation details
 */
interface CollectionOperation {
	promise: Promise<boolean>
	startedAt: number
}

/**
 * Client initialization operation details
 */
interface InitializationOperation {
	promise: Promise<QdrantClient>
	startedAt: number
	url: string
	apiKey?: string
}

/**
 * Circuit breaker states
 */
type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN"

/**
 * Circuit breaker for connection reliability
 */
interface CircuitBreaker {
	state: CircuitBreakerState
	failures: number
	lastFailureTime: number
	nextAttemptTime: number
}

/**
 * Enhanced Singleton QdrantClient with collection lifecycle coordination
 * Prevents connection issues, race conditions, and provides shared collection state management
 */
class QdrantClientSingleton {
	private static instance?: QdrantClient
	private static currentUrl?: string
	private static currentApiKey?: string

	// Client initialization locks to prevent concurrent getInstance() calls
	private static initializationLock?: InitializationOperation

	// Collection registry for tracking active collections across systems
	private static collectionRegistry = new Map<string, CollectionState>()

	// Collection operation locks to prevent concurrent creation
	private static collectionLocks = new Map<string, CollectionOperation>()

	// Circuit breaker for connection reliability
	private static circuitBreaker: CircuitBreaker = {
		state: "CLOSED",
		failures: 0,
		lastFailureTime: 0,
		nextAttemptTime: 0,
	}

	// Health check intervals
	private static healthCheckInterval?: NodeJS.Timeout
	private static readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds
	private static readonly COLLECTION_TIMEOUT = 300000 // 5 minutes
	private static readonly MAX_RETRY_ATTEMPTS = 3
	private static readonly CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5
	private static readonly CIRCUIT_BREAKER_TIMEOUT = 60000 // 1 minute
	private static readonly CIRCUIT_BREAKER_HALF_OPEN_TIMEOUT = 30000 // 30 seconds

	public static getInstance(url: string, apiKey?: string): QdrantClient {
		// Return existing client if URL and key match
		if (this.instance && this.currentUrl === url && this.currentApiKey === apiKey) {
			// Validate connection asynchronously if circuit breaker allows it
			if (this.shouldValidateConnection()) {
				this.validateClientConnection().catch((error) => {
					console.warn("[QdrantClientSingleton] Connection validation failed:", error)
					this.recordFailure()
				})
			}
			return this.instance
		}

		// Check circuit breaker state before creating new instance
		if (!this.canAttemptConnection()) {
			throw new Error("Circuit breaker is open - connection attempts are temporarily blocked")
		}

		// Create new client if URL or key changed
		try {
			const client = createQdrantClientFromUrl(url, apiKey)
			this.instance = client
			this.currentUrl = url
			this.currentApiKey = apiKey

			// Asynchronously validate connection and record success/failure
			this.validateClientConnection(client)
				.then(() => {
					this.recordSuccess()
					console.log("[QdrantClientSingleton] Client initialization and validation successful")
				})
				.catch((error) => {
					console.warn("[QdrantClientSingleton] Client validation failed:", error)
					this.recordFailure()
				})

			// Initialize health monitoring if not already started
			this.startHealthMonitoring()

			return client
		} catch (error) {
			this.recordFailure()
			console.error("[QdrantClientSingleton] Client creation failed:", error)
			throw error
		}
	}

	/**
	 * Performs client initialization with retry logic (for future use)
	 */
	private static async performClientInitializationAsync(url: string, apiKey?: string): Promise<QdrantClient> {
		let lastError: Error | undefined

		for (let attempt = 1; attempt <= this.MAX_RETRY_ATTEMPTS; attempt++) {
			try {
				console.log(
					`[QdrantClientSingleton] Client initialization attempt ${attempt}/${this.MAX_RETRY_ATTEMPTS}`,
				)

				// Create the client
				const client = createQdrantClientFromUrl(url, apiKey)

				// Validate the connection
				await this.validateClientConnection(client)

				// Success - record it
				this.recordSuccess()

				console.log("[QdrantClientSingleton] Client initialization successful")
				return client
			} catch (error) {
				lastError = error as Error
				console.error(`[QdrantClientSingleton] Initialization attempt ${attempt} failed:`, error)

				if (attempt < this.MAX_RETRY_ATTEMPTS) {
					const backoffMs = this.calculateBackoffDelay(attempt)
					console.log(`[QdrantClientSingleton] Retrying in ${backoffMs}ms...`)
					await this.sleep(backoffMs)
				}
			}
		}

		// All attempts failed
		this.recordFailure()
		throw new Error(`Client initialization failed after ${this.MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`)
	}

	/**
	 * Validates client connection by attempting a simple operation
	 */
	private static async validateClientConnection(client?: QdrantClient): Promise<void> {
		const clientToValidate = client || this.instance
		if (!clientToValidate) {
			throw new Error("No client available for validation")
		}

		try {
			// Simple health check - list collections
			await clientToValidate.getCollections()
		} catch (error) {
			throw new Error(`Connection validation failed: ${error}`)
		}
	}

	/**
	 * Checks if circuit breaker allows connection attempts
	 */
	private static canAttemptConnection(): boolean {
		const now = Date.now()

		switch (this.circuitBreaker.state) {
			case "CLOSED":
				return true

			case "OPEN":
				if (now >= this.circuitBreaker.nextAttemptTime) {
					console.log("[QdrantClientSingleton] Circuit breaker transitioning to HALF_OPEN")
					this.circuitBreaker.state = "HALF_OPEN"
					return true
				}
				return false

			case "HALF_OPEN":
				return true

			default:
				return false
		}
	}

	/**
	 * Checks if connection should be validated based on circuit breaker state
	 */
	private static shouldValidateConnection(): boolean {
		return this.circuitBreaker.state !== "OPEN"
	}

	/**
	 * Records a successful operation and potentially closes circuit breaker
	 */
	private static recordSuccess(): void {
		if (this.circuitBreaker.state === "HALF_OPEN") {
			console.log("[QdrantClientSingleton] Circuit breaker closing after successful operation")
			this.circuitBreaker.state = "CLOSED"
		}

		this.circuitBreaker.failures = 0
		this.circuitBreaker.lastFailureTime = 0
	}

	/**
	 * Records a failure and potentially opens circuit breaker
	 */
	private static recordFailure(): void {
		this.circuitBreaker.failures++
		this.circuitBreaker.lastFailureTime = Date.now()

		if (this.circuitBreaker.failures >= this.CIRCUIT_BREAKER_FAILURE_THRESHOLD) {
			console.log("[QdrantClientSingleton] Circuit breaker opening due to failure threshold")
			this.circuitBreaker.state = "OPEN"
			this.circuitBreaker.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT
		}
	}

	/**
	 * Calculates exponential backoff delay for retries
	 */
	private static calculateBackoffDelay(attempt: number): number {
		// Base delay of 1 second with exponential backoff and jitter
		const baseDelay = 1000
		const exponentialDelay = baseDelay * Math.pow(2, attempt - 1)
		const jitter = Math.random() * 0.3 * exponentialDelay // Add 30% jitter
		return Math.min(exponentialDelay + jitter, 10000) // Cap at 10 seconds
	}

	/**
	 * Promise-based sleep utility
	 */
	private static sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms))
	}

	/**
	 * Coordinated collection creation with mutex locking
	 * Prevents race conditions when multiple systems try to create collections simultaneously
	 */
	public static async ensureCollection(
		collectionName: string,
		workspacePath: string,
		dimension: number,
		options: EnsureCollectionOptions = {},
	): Promise<boolean> {
		if (!this.instance) {
			throw new Error("QdrantClientSingleton not initialized. Call getInstance() first.")
		}

		const lockKey = `${collectionName}-${workspacePath}`
		console.log(`[QdrantClientSingleton] ensureCollection called for ${lockKey}`, {
			collectionName,
			workspacePath,
			dimension,
			hasExistingLock: this.collectionLocks.has(lockKey),
			registryState: this.collectionRegistry.get(lockKey)?.status,
		})

		// Check if there's an existing operation for this collection
		const existingOperation = this.collectionLocks.get(lockKey)
		if (existingOperation) {
			console.log(`[QdrantClientSingleton] Waiting for existing operation: ${lockKey}`)
			try {
				const result = await existingOperation.promise
				console.log(`[QdrantClientSingleton] Existing operation completed: ${lockKey}`, { result })
				return result
			} catch (error) {
				console.error(`[QdrantClientSingleton] Existing operation failed: ${lockKey}`, error)
				// Remove failed operation from locks to allow retry
				this.collectionLocks.delete(lockKey)
			}
		}

		// Check collection registry for existing state
		const existingState = this.collectionRegistry.get(lockKey)
		if (existingState && existingState.status === "ready" && existingState.dimension === dimension) {
			// Update last accessed time
			existingState.lastAccessed = Date.now()
			console.log(`[QdrantClientSingleton] Collection already ready: ${lockKey}`)
			return false // Collection already existed
		}

		// Create new operation promise
		const operationPromise = this.performCollectionCreation(collectionName, workspacePath, dimension, options)

		const operation: CollectionOperation = {
			promise: operationPromise,
			startedAt: Date.now(),
		}

		// Register the operation
		this.collectionLocks.set(lockKey, operation)

		try {
			const result = await operationPromise
			console.log(`[QdrantClientSingleton] Collection operation completed: ${lockKey}`, { result })
			return result
		} catch (error) {
			console.error(`[QdrantClientSingleton] Collection operation failed: ${lockKey}`, error)
			throw error
		} finally {
			// Clean up the lock
			this.collectionLocks.delete(lockKey)
		}
	}

	/**
	 * Performs the actual collection creation with error handling and validation
	 */
	private static async performCollectionCreation(
		collectionName: string,
		workspacePath: string,
		dimension: number,
		options: EnsureCollectionOptions,
	): Promise<boolean> {
		const lockKey = `${collectionName}-${workspacePath}`
		const now = Date.now()

		// Update registry state to 'creating'
		this.collectionRegistry.set(lockKey, {
			name: collectionName,
			workspace: workspacePath,
			dimension,
			status: "creating",
			lastAccessed: now,
			createdAt: now,
			options,
		})

		console.log(`[QdrantClientSingleton] Starting collection creation: ${lockKey}`)

		try {
			// Validate client instance
			if (!this.instance) {
				throw new Error("QdrantClient instance not available")
			}

			// Check if collection already exists before creation
			const existsBeforeCreation = await this.validateCollectionExists(collectionName)
			console.log(`[QdrantClientSingleton] Collection exists check: ${collectionName}`, { existsBeforeCreation })

			// Use the common ensureCollection function for consistent behavior
			const wasCreated = await ensureCollection(this.instance, collectionName, dimension, options)

			// Validate the collection was properly created/configured
			await this.validateCollectionState(collectionName, dimension)

			// Update registry state to 'ready'
			const state = this.collectionRegistry.get(lockKey)
			if (state) {
				state.status = "ready"
				state.lastAccessed = Date.now()
			}

			console.log(`[QdrantClientSingleton] Collection creation successful: ${lockKey}`, {
				wasCreated,
				existedBefore: existsBeforeCreation,
			})

			return wasCreated
		} catch (error) {
			console.error(`[QdrantClientSingleton] Collection creation failed: ${lockKey}`, error)

			// Update registry state to 'error'
			const state = this.collectionRegistry.get(lockKey)
			if (state) {
				state.status = "error"
				state.lastAccessed = Date.now()
			}

			throw error
		}
	}

	/**
	 * Validates that a collection exists and is accessible
	 */
	private static async validateCollectionExists(collectionName: string): Promise<boolean> {
		if (!this.instance) return false

		try {
			await this.instance.getCollection(collectionName)
			return true
		} catch (error) {
			return false
		}
	}

	/**
	 * Validates collection state and configuration
	 */
	private static async validateCollectionState(collectionName: string, expectedDimension: number): Promise<void> {
		if (!this.instance) {
			throw new Error("QdrantClient instance not available for validation")
		}

		try {
			const info = await this.instance.getCollection(collectionName)

			// Validate vector configuration
			const vectorsConfig = info.config?.params?.vectors as any
			const actualDimension = typeof vectorsConfig === "number" ? vectorsConfig : (vectorsConfig?.size ?? 0)

			if (actualDimension !== expectedDimension) {
				throw new Error(`Collection dimension mismatch: expected ${expectedDimension}, got ${actualDimension}`)
			}

			console.log(`[QdrantClientSingleton] Collection validation successful: ${collectionName}`, {
				dimension: actualDimension,
				pointsCount: info.points_count,
			})
		} catch (error) {
			throw new Error(`Collection validation failed for ${collectionName}: ${error}`)
		}
	}

	/**
	 * Gets collection state from registry
	 */
	public static getCollectionState(collectionName: string, workspacePath: string): CollectionState | undefined {
		const lockKey = `${collectionName}-${workspacePath}`
		return this.collectionRegistry.get(lockKey)
	}

	/**
	 * Lists all registered collections for debugging
	 */
	public static listRegisteredCollections(): CollectionState[] {
		return Array.from(this.collectionRegistry.values())
	}

	/**
	 * Starts health monitoring for collections
	 */
	private static startHealthMonitoring(): void {
		if (this.healthCheckInterval) return // Already started

		console.log("[QdrantClientSingleton] Starting collection health monitoring")
		this.healthCheckInterval = setInterval(() => {
			this.performHealthCheck().catch((error) => {
				console.error("[QdrantClientSingleton] Health check error:", error)
			})
		}, this.HEALTH_CHECK_INTERVAL)
	}

	/**
	 * Performs periodic health checks on registered collections
	 */
	private static async performHealthCheck(): Promise<void> {
		if (!this.instance) return

		const now = Date.now()
		const collectionsToCheck = Array.from(this.collectionRegistry.entries())

		for (const [lockKey, state] of collectionsToCheck) {
			// Skip recently created collections (give them time to settle)
			if (now - state.createdAt < 30000) continue

			// Check for stale collections that haven't been accessed recently
			if (now - state.lastAccessed > this.COLLECTION_TIMEOUT) {
				console.log(`[QdrantClientSingleton] Removing stale collection from registry: ${lockKey}`)
				this.collectionRegistry.delete(lockKey)
				continue
			}

			// Health check for ready collections
			if (state.status === "ready") {
				try {
					const exists = await this.validateCollectionExists(state.name)
					if (!exists) {
						console.warn(`[QdrantClientSingleton] Collection no longer exists: ${state.name}`)
						state.status = "error"
					}
				} catch (error) {
					console.warn(`[QdrantClientSingleton] Health check failed for collection: ${state.name}`, error)
					state.status = "error"
				}
			}
		}

		// Clean up old operation locks
		const staleLocks = Array.from(this.collectionLocks.entries()).filter(
			([_, operation]) => now - operation.startedAt > this.COLLECTION_TIMEOUT,
		)

		for (const [lockKey] of staleLocks) {
			console.warn(`[QdrantClientSingleton] Removing stale collection lock: ${lockKey}`)
			this.collectionLocks.delete(lockKey)
		}
	}

	/**
	 * Stops health monitoring (useful for cleanup)
	 */
	private static stopHealthMonitoring(): void {
		if (this.healthCheckInterval) {
			clearInterval(this.healthCheckInterval)
			this.healthCheckInterval = undefined
			console.log("[QdrantClientSingleton] Stopped collection health monitoring")
		}
	}

	public static reset(): void {
		this.stopHealthMonitoring()
		this.instance = undefined
		this.currentUrl = undefined
		this.currentApiKey = undefined
		this.initializationLock = undefined
		this.collectionRegistry.clear()
		this.collectionLocks.clear()

		// Reset circuit breaker
		this.circuitBreaker = {
			state: "CLOSED",
			failures: 0,
			lastFailureTime: 0,
			nextAttemptTime: 0,
		}

		console.log("[QdrantClientSingleton] Reset completed - all state cleared")
	}

	/**
	 * Gets current circuit breaker state for debugging
	 */
	public static getCircuitBreakerState(): CircuitBreaker {
		return { ...this.circuitBreaker }
	}

	/**
	 * Forces circuit breaker state (for testing purposes)
	 */
	public static forceCircuitBreakerState(state: CircuitBreakerState): void {
		this.circuitBreaker.state = state
		if (state === "OPEN") {
			this.circuitBreaker.nextAttemptTime = Date.now() + this.CIRCUIT_BREAKER_TIMEOUT
		}
	}

	/**
	 * Force cleanup of a specific collection from registry (for testing/debugging)
	 */
	public static forceCleanupCollection(collectionName: string, workspacePath: string): void {
		const lockKey = `${collectionName}-${workspacePath}`
		this.collectionRegistry.delete(lockKey)
		this.collectionLocks.delete(lockKey)
		console.log(`[QdrantClientSingleton] Force cleanup completed for: ${lockKey}`)
	}
}

export { QdrantClientSingleton }
export type { CollectionState }
