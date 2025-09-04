import * as vscode from "vscode"
import { getWorkspacePath } from "../../utils/path"
import { ContextProxy } from "../../core/config/ContextProxy"
import { ConversationMemoryConfigManager } from "./config-manager"
import { ConversationMemoryStateManager } from "./state-manager"
import { ConversationMemoryServiceFactory } from "./service-factory"
import { ConversationMemoryOrchestrator } from "./orchestrator"
import { CodeIndexConfigManager } from "../code-index/config-manager"
import type { ApiHandler } from "../../api"
import { RooApiLlmProviderAdapter } from "./adapters/roo-api-llm-adapter"

export class ConversationMemoryManager {
	private static instances = new Map<string, ConversationMemoryManager>()
	public static getInstance(
		context: vscode.ExtensionContext,
		workspacePath?: string,
	): ConversationMemoryManager | undefined {
		try {
			console.log(
				"[ConversationMemoryManager.getInstance] Starting getInstance with workspacePath:",
				workspacePath,
			)

			if (!workspacePath) {
				console.log(
					"[ConversationMemoryManager.getInstance] No workspacePath provided, attempting to determine...",
				)
				const activeEditor = vscode.window.activeTextEditor
				if (activeEditor) {
					const workspaceFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri)
					workspacePath = workspaceFolder?.uri.fsPath
					console.log(
						"[ConversationMemoryManager.getInstance] Got workspacePath from activeEditor:",
						workspacePath,
					)
				}
				if (!workspacePath) {
					const workspaceFolders = vscode.workspace.workspaceFolders
					if (!workspaceFolders || workspaceFolders.length === 0) {
						console.warn(
							"[ConversationMemoryManager.getInstance] No workspace folders found - conversation memory requires an open workspace",
						)
						return undefined
					}
					workspacePath = workspaceFolders[0].uri.fsPath
					console.log("[ConversationMemoryManager.getInstance] Using first workspace folder:", workspacePath)
				}
			}

			if (!this.instances.has(workspacePath)) {
				console.log("[ConversationMemoryManager.getInstance] Creating new instance for:", workspacePath)
				try {
					const instance = new ConversationMemoryManager(workspacePath, context)
					console.log("[ConversationMemoryManager.getInstance] Instance created successfully")
					this.instances.set(workspacePath, instance)
				} catch (error) {
					console.error("[ConversationMemoryManager.getInstance] Failed to create instance:", error)
					console.error("[ConversationMemoryManager.getInstance] Stack trace:", (error as Error).stack)

					// Provide specific error guidance instead of silent failure
					const errorMessage = error instanceof Error ? error.message : String(error)
					if (errorMessage.includes("config") || errorMessage.includes("Config")) {
						console.error(
							"[ConversationMemoryManager.getInstance] Configuration error - check Code Index settings",
						)
					} else if (errorMessage.includes("permission") || errorMessage.includes("access")) {
						console.error(
							"[ConversationMemoryManager.getInstance] Permission error - check workspace access",
						)
					}

					// Still return undefined for graceful degradation but with better logging
					return undefined
				}
			} else {
				console.log("[ConversationMemoryManager.getInstance] Returning existing instance for:", workspacePath)
			}

			return this.instances.get(workspacePath)!
		} catch (error) {
			console.error("[ConversationMemoryManager.getInstance] Unhandled error in getInstance:", error)
			console.error("[ConversationMemoryManager.getInstance] Stack trace:", (error as Error).stack)

			// Provide actionable error information instead of silent failure
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error(`[ConversationMemoryManager.getInstance] Error context: ${errorMessage}`)
			console.error(
				"[ConversationMemoryManager.getInstance] Conversation memory will be disabled for this session",
			)

			return undefined
		}
	}

	private configManager?: ConversationMemoryConfigManager
	private stateManager: ConversationMemoryStateManager
	private orchestrator?: ConversationMemoryOrchestrator
	private factory?: ConversationMemoryServiceFactory

	private constructor(
		private readonly workspacePath: string,
		private readonly context: vscode.ExtensionContext,
	) {
		try {
			// Follow CodeIndexManager pattern - minimal constructor
			this.stateManager = new ConversationMemoryStateManager()
			// Config managers will be created in initialize() with proper ContextProxy
		} catch (error) {
			console.error("[ConversationMemoryManager] Failed in constructor:", error)
			throw error
		}
	}

	public get isFeatureEnabled(): boolean {
		return this.configManager?.isFeatureEnabled ?? false
	}

	public get isFeatureConfigured(): boolean {
		return this.configManager?.isFeatureConfigured ?? false
	}

	public get isInitialized(): boolean {
		return !!this.orchestrator
	}

	public async initialize(contextProxy: ContextProxy): Promise<void> {
		console.log("[ConversationMemoryManager.initialize] Starting initialization for workspace:", this.workspacePath)

		let codeIndexConfig: CodeIndexConfigManager

		try {
			// Get the existing CodeIndexManager instance instead of creating a new config
			console.log("[ConversationMemoryManager.initialize] Getting existing CodeIndexManager instance...")
			const codeIndexManager = (await import("../code-index/manager")).CodeIndexManager.getInstance(
				this.context,
				this.workspacePath,
			)

			if (!codeIndexManager) {
				const error = new Error(
					"Code Index manager not found - conversation memory requires Code Index to be available",
				)
				console.warn("[ConversationMemoryManager.initialize]", error.message)
				console.warn(
					"[ConversationMemoryManager.initialize] Please ensure Code Index is properly installed and configured",
				)
				this.stateManager.setSystemState("Error", "Code Index dependency missing")
				return // Graceful degradation with clear error state
			}

			if (!codeIndexManager.isInitialized) {
				const error = new Error(
					"Code Index not initialized - conversation memory depends on Code Index being ready",
				)
				console.warn("[ConversationMemoryManager.initialize]", error.message)
				console.warn(
					"[ConversationMemoryManager.initialize] Wait for Code Index initialization to complete, then retry",
				)
				this.stateManager.setSystemState("Warning", "Waiting for Code Index initialization")
				return // Graceful degradation with clear warning state
			}

			const codeIndexConfigMaybe = codeIndexManager.getConfigManager()
			if (!codeIndexConfigMaybe) {
				const error = new Error(
					"Code Index configuration not available - conversation memory requires embedder configuration",
				)
				console.warn("[ConversationMemoryManager.initialize]", error.message)
				console.warn("[ConversationMemoryManager.initialize] Please configure embedder settings in Code Index")
				this.stateManager.setSystemState("Error", "Code Index configuration missing")
				return // Graceful degradation with clear error state
			}
			codeIndexConfig = codeIndexConfigMaybe
			console.log("[ConversationMemoryManager.initialize] Using existing CodeIndexConfig successfully")

			console.log("[ConversationMemoryManager.initialize] Creating ConversationMemoryConfigManager...")
			this.configManager = new ConversationMemoryConfigManager(contextProxy, codeIndexConfig)
			console.log("[ConversationMemoryManager.initialize] ConversationMemoryConfigManager created successfully")

			console.log("[ConversationMemoryManager.initialize] Creating ConversationMemoryServiceFactory...")
			this.factory = new ConversationMemoryServiceFactory(this.workspacePath, codeIndexConfig)
			console.log("[ConversationMemoryManager.initialize] ConversationMemoryServiceFactory created successfully")
		} catch (error) {
			console.error("[ConversationMemoryManager.initialize] Failed during config setup:", error)
			console.error("[ConversationMemoryManager.initialize] Stack trace:", (error as Error).stack)
			throw error
		}

		console.log("[ConversationMemoryManager.initialize] Feature enabled:", this.configManager.isFeatureEnabled)
		if (!this.configManager.isFeatureEnabled) {
			console.log("[ConversationMemoryManager.initialize] Feature disabled, skipping orchestrator setup")
			return
		}

		try {
			console.log("[ConversationMemoryManager.initialize] Checking Code Index configuration...")
			// Check if Code Index is configured first
			if (!codeIndexConfig.isFeatureConfigured) {
				const error = new Error(
					"Code Index embeddings not configured - conversation memory requires embedder setup",
				)
				console.warn("[ConversationMemoryManager.initialize]", error.message)
				console.warn("[ConversationMemoryManager.initialize] Please configure Code Index embeddings first")
				console.warn(
					"[ConversationMemoryManager.initialize] Required: OpenAI API key or other embedder configuration in Code Index settings",
				)
				this.stateManager.setSystemState("Error", "Embeddings not configured - check Code Index settings")
				return
			}

			if (!codeIndexConfig.isFeatureEnabled) {
				const error = new Error(
					"Code Index is disabled - conversation memory requires Code Index to be enabled",
				)
				console.warn("[ConversationMemoryManager.initialize]", error.message)
				console.warn("[ConversationMemoryManager.initialize] Please enable Code Index in settings")
				this.stateManager.setSystemState("Error", "Code Index disabled - enable in settings")
				return
			}

			console.log("[ConversationMemoryManager.initialize] Creating embedder and vector store")
			console.log("[ConversationMemoryManager.initialize] Code Index config status:", {
				isConfigured: codeIndexConfig.isFeatureConfigured,
				provider: codeIndexConfig.getConfig().embedderProvider,
				hasQdrant: !!codeIndexConfig.qdrantConfig.url,
			})

			console.log("[ConversationMemoryManager.initialize] Creating embedder...")
			let embedder: any
			try {
				embedder = this.factory!.createEmbedder()
				console.log("[ConversationMemoryManager.initialize] Embedder created successfully")
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				console.error("[ConversationMemoryManager.initialize] Failed to create embedder:", error)
				console.error(
					"[ConversationMemoryManager.initialize] This usually means Code Index embedder is not properly configured",
				)

				// Set specific error state based on error type
				if (errorMessage.includes("API key") || errorMessage.includes("authentication")) {
					this.stateManager.setSystemState("Error", "Embedder authentication failed - check API key")
				} else if (errorMessage.includes("configuration") || errorMessage.includes("config")) {
					this.stateManager.setSystemState(
						"Error",
						"Embedder configuration invalid - check Code Index settings",
					)
				} else {
					this.stateManager.setSystemState("Error", `Embedder creation failed: ${errorMessage}`)
				}

				// For embedder creation failures, gracefully degrade but log the issue
				// This allows the extension to continue working without memory features
				return
			}

			// Test the embedder to make sure it works
			console.log("[ConversationMemoryManager.initialize] Testing embedder with sample text")
			let testEmbedding: number[] | undefined
			try {
				testEmbedding = await embedder.embed("test")
				console.log(
					"[ConversationMemoryManager.initialize] Test embedding result length:",
					testEmbedding?.length || 0,
				)
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error)
				console.error("[ConversationMemoryManager.initialize] Embedder test failed with error:", error)
				console.error(
					"[ConversationMemoryManager.initialize] This likely means the API key is missing or invalid",
				)

				// Set specific error state but gracefully degrade for API issues
				if (
					errorMessage.includes("API key") ||
					errorMessage.includes("401") ||
					errorMessage.includes("Unauthorized")
				) {
					this.stateManager.setSystemState(
						"Error",
						"Embedder API key invalid - check Code Index configuration",
					)
				} else if (errorMessage.includes("network") || errorMessage.includes("connect")) {
					this.stateManager.setSystemState("Error", "Embedder service unreachable - check network connection")
				} else {
					this.stateManager.setSystemState("Error", `Embedder test failed: ${errorMessage}`)
				}

				// For API/auth failures, gracefully degrade rather than crashing
				return
			}

			if (!testEmbedding || testEmbedding.length === 0) {
				const error = new Error("Embedder test failed - returning empty embeddings")
				console.error("[ConversationMemoryManager.initialize]", error.message)
				console.error(
					"[ConversationMemoryManager.initialize] Please check your Code Index embedding API key configuration",
				)
				console.error(
					"[ConversationMemoryManager.initialize] For OpenAI: Add your API key in Code Index settings",
				)

				this.stateManager.setSystemState("Error", "Embedder returns empty results - check API key")
				// Gracefully degrade for empty embeddings rather than throwing
				return
			}

			console.log("[ConversationMemoryManager.initialize] Creating vector store...")
			const vector = this.factory!.createVectorStore()
			console.log("[ConversationMemoryManager.initialize] Vector store created successfully")

			console.log("[ConversationMemoryManager.initialize] Creating orchestrator...")
			// No env-based provider; llm provided per-turn from Task ApiHandler
			const episodeConfig = this.configManager?.getConfig()?.episodes
			this.orchestrator = new ConversationMemoryOrchestrator(
				this.workspacePath,
				vector,
				embedder,
				this.stateManager,
				undefined, // llm provided per-turn
				episodeConfig,
			)
			console.log("[ConversationMemoryManager.initialize] Orchestrator created, starting...")
			await this.orchestrator.start()
			console.log("[ConversationMemoryManager.initialize] Orchestrator started successfully")
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("[ConversationMemoryManager.initialize] Failed to initialize orchestrator:", error)
			console.error("[ConversationMemoryManager.initialize] Stack trace:", (error as Error).stack)

			// Set appropriate error state based on the specific failure
			if (errorMessage.includes("embedder") || errorMessage.includes("Embedder")) {
				this.stateManager.setSystemState("Error", "Memory initialization failed - embedder configuration issue")
				console.error(
					"[ConversationMemoryManager.initialize] Fix: Check Code Index embedder configuration and API keys",
				)
			} else if (errorMessage.includes("vector") || errorMessage.includes("Qdrant")) {
				this.stateManager.setSystemState("Error", "Memory initialization failed - vector store unavailable")
				console.error(
					"[ConversationMemoryManager.initialize] Fix: Check Qdrant server connection and configuration",
				)
			} else if (errorMessage.includes("API key")) {
				this.stateManager.setSystemState("Error", "Memory initialization failed - invalid API credentials")
				console.error("[ConversationMemoryManager.initialize] Fix: Verify API keys in Code Index settings")
			} else {
				this.stateManager.setSystemState("Error", `Memory initialization failed: ${errorMessage}`)
				console.error(
					"[ConversationMemoryManager.initialize] General fix: Check Code Index embeddings configuration",
				)
			}

			// Still don't throw to allow chat to continue, but ensure error state is visible to users
		}

		// Subscribe to Code Index events for event-driven sync
		try {
			console.log("[ConversationMemoryManager.initialize] Setting up Code Index integration")
			const codeIndexMgr = (await import("../code-index/manager")).CodeIndexManager.getInstance(
				this.context,
				this.workspacePath,
			)
			if (codeIndexMgr && codeIndexMgr.isFeatureEnabled) {
				console.log("[ConversationMemoryManager.initialize] Code Index enabled, subscribing to onFilesIndexed")
				codeIndexMgr.onFilesIndexed(async (files) => {
					if (!this.orchestrator) return
					const { handleFilesIndexed } = await import("./orchestrator")
					try {
						await handleFilesIndexed(this.orchestrator, files as any)
					} catch (err) {
						console.error("[ConversationMemoryManager.initialize] Error handling indexed files:", err)
					}
				})
			} else {
				console.log("[ConversationMemoryManager.initialize] Code Index not enabled or not available")
			}
		} catch (error) {
			console.error("[ConversationMemoryManager.initialize] Failed to setup Code Index integration:", error)
			console.error("[ConversationMemoryManager.initialize] Stack trace:", (error as Error).stack)
			// best-effort
		}

		console.log("[ConversationMemoryManager.initialize] Initialization complete for workspace:", this.workspacePath)
	}

	public async searchMemory(query: string) {
		if (!this.orchestrator) return []
		return this.orchestrator.search(query)
	}

	public async searchEpisodes(query: string, limit: number = 5) {
		if (!this.orchestrator) return []
		return this.orchestrator.searchEpisodes(query, limit)
	}

	/**
	 * Enhanced search method with filtering support for the conversation memory search UI
	 */
	public async searchMemoriesWithFilters(options: {
		query: string
		timeRange?: { start?: Date; end?: Date }
		episodeType?: "all" | "conversation" | "fact" | "insight"
		relevanceThreshold?: number
		limit?: number
	}): Promise<any[]> {
		if (!this.orchestrator) {
			console.warn("[ConversationMemoryManager] Orchestrator not available for filtered search")
			return []
		}

		const { query, timeRange, episodeType, relevanceThreshold, limit = 10 } = options

		try {
			// Start with episode search as it provides richer context
			let results = await this.orchestrator.searchEpisodes(query, Math.max(limit * 2, 20))

			// If no episodes found, fall back to fact search
			if (!results || results.length === 0) {
				const facts = await this.orchestrator.search(query)
				results = facts.map((fact: any) => ({
					...fact,
					episodeType: "fact",
					title: fact.summary || fact.content?.substring(0, 50) || "Memory",
					relevanceScore: fact.score || 0.5,
				}))
			}

			// Apply time range filter
			if (timeRange && (timeRange.start || timeRange.end)) {
				results = results.filter((result: any) => {
					const timestamp = new Date(result.timestamp || result.createdAt || 0)
					if (timeRange.start && timestamp < timeRange.start) return false
					if (timeRange.end && timestamp > timeRange.end) return false
					return true
				})
			}

			// Apply episode type filter
			if (episodeType && episodeType !== "all") {
				results = results.filter((result: any) => {
					const resultType = result.episodeType || result.type || "fact"
					return resultType === episodeType
				})
			}

			// Apply relevance threshold filter
			if (typeof relevanceThreshold === "number" && relevanceThreshold > 0) {
				results = results.filter((result: any) => {
					const score = result.relevanceScore || result.score || 0
					return score >= relevanceThreshold
				})
			}

			// Apply limit and ensure results are properly formatted
			return results.slice(0, limit).map((result: any) => ({
				id: result.id || result.episodeId || `result_${Date.now()}_${Math.random()}`,
				title: result.title || result.summary || result.content?.substring(0, 50) || "Memory",
				content: result.content || result.text || result.summary || "",
				timestamp: result.timestamp || result.createdAt || new Date(),
				episodeType: result.episodeType || result.type || "fact",
				relevanceScore: result.relevanceScore || result.score || 0,
				episodeId: result.episodeId || result.id,
				metadata: result.metadata || {},
			}))
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("[ConversationMemoryManager.searchMemoriesWithFilters] Search failed:", errorMessage)

			// Re-throw with context for the message handler to catch and handle appropriately
			throw new Error(`Memory search failed: ${errorMessage}`)
		}
	}

	/**
	 * Collect a message for episode-based processing (replaces ingestTurn)
	 */
	public async collectMessage(message: import("./types").Message): Promise<void> {
		if (!this.orchestrator) {
			const error = new Error("Orchestrator not available - conversation memory not initialized")
			console.warn("[ConversationMemoryManager]", error.message)
			console.warn("[ConversationMemoryManager] Ensure memory feature is enabled and properly configured")
			return
		}

		// Non-blocking collection - let orchestrator handle background processing
		try {
			await this.orchestrator.collectMessage(message)
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("[ConversationMemoryManager] Error collecting message:", errorMessage)

			// Don't throw but provide specific guidance
			if (errorMessage.includes("Invalid message")) {
				console.error("[ConversationMemoryManager] Message validation failed - check message content")
			} else if (errorMessage.includes("Episode detector")) {
				console.error("[ConversationMemoryManager] Episode detection unavailable - check memory configuration")
			}
		}
	}

	public async processCurrentConversation(): Promise<void> {
		// For Phase 1/2, processing is opt-in; this method can be wired later
		return
	}

	/** Clears all conversation memory data for this workspace. */
	public async clearMemoryData(): Promise<void> {
		if (!this.orchestrator) return
		try {
			await this.orchestrator.clearMemoryData()
		} catch (e) {
			console.error("[ConversationMemoryManager] Failed to clear memory data:", (e as any)?.message || e)
		}
	}

	/**
	 * Immediate, turn-level ingestion entrypoint.
	 */
	public async ingestTurn(
		messages: import("./types").Message[],
		api: ApiHandler,
		modelId?: string,
		toolMeta?: { name: string; params: any; resultText?: string },
	): Promise<void> {
		if (!this.orchestrator) {
			return
		}

		try {
			const llm = new RooApiLlmProviderAdapter(api)

			// Add a timeout wrapper around the entire processTurn operation
			const timeoutMs = 45000 // 45 seconds total timeout
			const timeoutPromise = new Promise((_, reject) => {
				setTimeout(() => reject(new Error("Memory ingestion timeout after 45s")), timeoutMs)
			})

			await Promise.race([
				this.orchestrator.processTurn(messages, llm, { modelId, ...(toolMeta ? { toolMeta } : {}) } as any),
				timeoutPromise,
			])
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error)
			console.error("[ConversationMemoryManager] Error processing turn:", errorMessage)

			// Provide specific guidance based on error type but don't throw
			if (errorMessage.includes("timeout")) {
				console.error(
					"[ConversationMemoryManager] Memory processing is taking too long - check system performance",
				)
			} else if (errorMessage.includes("LLM") || errorMessage.includes("API")) {
				console.error(
					"[ConversationMemoryManager] LLM service error during memory processing - check API status",
				)
			} else if (errorMessage.includes("vector") || errorMessage.includes("embedding")) {
				console.error("[ConversationMemoryManager] Storage or embedding error - check infrastructure")
			}

			// Don't throw - let the chat continue even if memory fails
		}
	}

	/**
	 * Session finalization hook (placeholder for future buffering/episodes).
	 */
	public async finalizeSession(): Promise<void> {
		// No-op for now; reserved for future buffered state/episode finalization
		return
	}

	/**
	 * Dispose of resources when the manager is no longer needed
	 */
	public dispose(): void {
		// Clean up orchestrator if it exists
		if (this.orchestrator) {
			// Orchestrator may have resources to clean up in the future
			this.orchestrator = undefined
		}
		// Remove from instances map
		ConversationMemoryManager.instances.delete(this.workspacePath)
	}

	/**
	 * Reload configuration (called when settings change)
	 */
	public async reloadConfiguration(): Promise<void> {
		if (this.configManager) {
			await this.configManager.reloadConfiguration()
		}
	}
}
