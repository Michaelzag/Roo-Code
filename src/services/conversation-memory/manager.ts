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
						console.log(
							"[ConversationMemoryManager.getInstance] No workspace folders found, returning undefined",
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
					throw error
				}
			} else {
				console.log("[ConversationMemoryManager.getInstance] Returning existing instance for:", workspacePath)
			}

			return this.instances.get(workspacePath)!
		} catch (error) {
			console.error("[ConversationMemoryManager.getInstance] Unhandled error in getInstance:", error)
			console.error("[ConversationMemoryManager.getInstance] Stack trace:", (error as Error).stack)
			// Don't throw - return undefined to let extension continue
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
				console.warn(
					"[ConversationMemoryManager.initialize] Code Index manager not found, disabling conversation memory",
				)
				return // Graceful degradation - memory won't work but extension continues
			}

			if (!codeIndexManager.isInitialized) {
				console.warn(
					"[ConversationMemoryManager.initialize] Code Index not initialized yet, disabling conversation memory",
				)
				return // Graceful degradation - memory won't work but extension continues
			}

			const codeIndexConfigMaybe = codeIndexManager.getConfigManager()
			if (!codeIndexConfigMaybe) {
				console.warn(
					"[ConversationMemoryManager.initialize] Code Index configuration not available, disabling conversation memory",
				)
				return // Graceful degradation - memory won't work but extension continues
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
				console.warn(
					"[ConversationMemoryManager.initialize] Code Index is not configured, memory feature cannot work without embeddings",
				)
				console.warn("[ConversationMemoryManager.initialize] Please configure Code Index embeddings first")
				console.warn(
					"[ConversationMemoryManager.initialize] Required: OpenAI API key or other embedder configuration in Code Index settings",
				)
				return
			}

			if (!codeIndexConfig.isFeatureEnabled) {
				console.warn(
					"[ConversationMemoryManager.initialize] Code Index is disabled, memory feature requires it to be enabled",
				)
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
				console.error("[ConversationMemoryManager.initialize] Failed to create embedder:", error)
				console.error(
					"[ConversationMemoryManager.initialize] This usually means Code Index embedder is not properly configured",
				)
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
				console.error("[ConversationMemoryManager.initialize] Embedder test failed with error:", error)
				console.error(
					"[ConversationMemoryManager.initialize] This likely means the API key is missing or invalid",
				)
				return
			}

			if (!testEmbedding || testEmbedding.length === 0) {
				console.error(
					"[ConversationMemoryManager.initialize] Embedder test failed - returning empty embeddings",
				)
				console.error(
					"[ConversationMemoryManager.initialize] Please check your Code Index embedding API key configuration",
				)
				console.error(
					"[ConversationMemoryManager.initialize] For OpenAI: Add your API key in Code Index settings",
				)
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
			console.error("[ConversationMemoryManager.initialize] Failed to initialize orchestrator:", error)
			console.error("[ConversationMemoryManager.initialize] Stack trace:", (error as Error).stack)
			console.error(
				"[ConversationMemoryManager.initialize] This usually means Code Index embeddings are not properly configured",
			)
			// Don't throw - let chat continue without memory
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
	 * Collect a message for episode-based processing (replaces ingestTurn)
	 */
	public async collectMessage(message: import("./types").Message): Promise<void> {
		if (!this.orchestrator) {
			return
		}

		// Non-blocking collection - let orchestrator handle background processing
		try {
			await this.orchestrator.collectMessage(message)
		} catch (error) {
			console.error("[ConversationMemoryManager] Error collecting message:", (error as Error).message)
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
			// Log but don't re-throw - memory ingestion should be non-fatal
			console.error("[ConversationMemoryManager] Error processing turn:", (error as Error).message)
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
