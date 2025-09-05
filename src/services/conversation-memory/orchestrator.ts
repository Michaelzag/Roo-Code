import * as path from "path"
import * as fs from "fs/promises"
import stripAnsi from "strip-ansi"
import type { IEmbedder, ILlmProvider, IVectorStore } from "./interfaces"
import type { CategorizedFactInput, ConversationEpisode, ProjectContext, EpisodeConfig } from "./types"
import { ConversationFactExtractor } from "./processors/fact-extractor"
import { ConflictResolver } from "./processors/conflict-resolver"
import { TemporalScorer } from "./lifecycle/temporal"
import { ConversationMemorySearchService } from "./search-service"
import { ConversationMemoryStateManager } from "./state-manager"
import { EpisodeDetector } from "./episode/EpisodeDetector"
import { EpisodeContextGenerator } from "./episode/EpisodeContextGenerator"
import { FileSystemHintsProvider, MemoryHintsProvider, AutoHintsProvider } from "./context/HintsProvider"
import type { Message } from "./types"

export class ConversationMemoryOrchestrator {
	private temporal: TemporalScorer
	private searchSvc: ConversationMemorySearchService
	private episodeDetector?: EpisodeDetector
	private messageBuffer: Message[] = []
	private processingInProgress = false

	private retention?: import("./lifecycle/retention").DebugFactRetentionService

	// CRITICAL FIX: Track initialization state to prevent race conditions
	private isInitialized = false
	private initializationPromise: Promise<void> | null = null
	private initializationError: Error | null = null

	constructor(
		private readonly workspacePath: string,
		private readonly vectorStore: IVectorStore,
		private readonly embedder: IEmbedder,
		private readonly stateManager: ConversationMemoryStateManager,
		private readonly llm?: ILlmProvider,
		private readonly episodeConfig?: EpisodeConfig,
	) {
		this.temporal = new TemporalScorer()
		this.searchSvc = new ConversationMemorySearchService(
			this.embedder,
			this.vectorStore,
			this.temporal,
			this.workspacePath,
		)

		// Initialize episode detection system
		if (this.llm && this.episodeConfig) {
			this.initializeEpisodeSystem()
		}
	}

	private initializeEpisodeSystem(): void {
		if (!this.llm || !this.episodeConfig) return

		// Create hints provider based on config
		const hintsProvider = this.createHintsProvider()

		// Create episode context generator (LLM-only)
		const contextGenerator = new EpisodeContextGenerator(this.llm, hintsProvider)

		// Create episode detector with configured segmentation
		this.episodeDetector = new EpisodeDetector(contextGenerator, this.embedder, this.llm, this.episodeConfig)
	}

	private createHintsProvider() {
		const source = this.episodeConfig?.context?.hints?.source ?? "auto"
		const extra = this.episodeConfig?.context?.hints?.extra ?? []

		const fsProvider = new FileSystemHintsProvider(this.workspacePath, extra)

		if (source === "workspace") {
			return fsProvider
		} else if (source === "memory") {
			return new MemoryHintsProvider(this.vectorStore, this.workspacePath)
		} else if (source === "auto") {
			const memoryProvider = new MemoryHintsProvider(this.vectorStore, this.workspacePath)
			return new AutoHintsProvider(fsProvider, memoryProvider)
		} else {
			return undefined // source === "none"
		}
	}

	public async start(): Promise<void> {
		// CRITICAL FIX: Prevent multiple initializations and provide singleton initialization
		if (this.isInitialized) {
			return
		}

		if (this.initializationPromise) {
			return this.initializationPromise
		}

		this.initializationPromise = this.performInitialization()
		await this.initializationPromise
		this.isInitialized = true
	}

	/**
	 * CRITICAL FIX: Ensures initialization completes before any operations
	 */
	private async ensureInitialized(): Promise<void> {
		if (this.isInitialized) {
			return
		}

		if (this.initializationPromise) {
			await this.initializationPromise
			return
		}

		// If not started, start initialization
		await this.start()
	}

	/**
	 * Get the current initialization status including error details
	 */
	public getInitializationStatus(): {
		isInitialized: boolean
		isInitializing: boolean
		error: Error | null
	} {
		return {
			isInitialized: this.isInitialized,
			isInitializing: !!this.initializationPromise && !this.isInitialized,
			error: this.initializationError,
		}
	}

	private async performInitialization(): Promise<void> {
		try {
			// Ensure collection exists
			const collectionName = this.collectionName()

			// Timeout for vector store operation with minimal diagnostic logging
			const collectionTimeout = new Promise<never>((_, reject) => {
				setTimeout(() => {
					reject(
						new Error(
							"vectorStore.ensureCollection timed out after 60 seconds - likely Qdrant connection issue",
						),
					)
				}, 60000)
			})

			try {
				await Promise.race([
					this.vectorStore.ensureCollection(collectionName, this.embedder.dimension),
					collectionTimeout,
				])
			} catch (error) {
				console.error("[ConversationMemoryOrchestrator] vectorStore.ensureCollection failed:", error)
				throw error
			}

			this.stateManager.setSystemState("Indexed", "Conversation memory ready")

			// Start retention service (best-effort)
			try {
				const { DebugFactRetentionService } = await import("./lifecycle/retention")
				this.retention = new DebugFactRetentionService(this.vectorStore as any, this.workspacePath)
				this.retention.start()
			} catch {
				// ignore
			}
		} catch (error: any) {
			this.initializationError = error instanceof Error ? error : new Error(String(error))
			const errorMessage = error?.message || String(error)
			console.error("[ConversationMemoryOrchestrator] Failed to start:", errorMessage)

			// Set error state for UI feedback
			let userErrorMessage: string
			if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("connect")) {
				userErrorMessage = "Qdrant server not accessible"
			} else if (errorMessage.includes("dimension")) {
				userErrorMessage = "Invalid embedder dimension"
			} else {
				userErrorMessage = `Failed to initialize: ${errorMessage}`
			}

			this.stateManager.setSystemState("Error", userErrorMessage)

			// Critical startup errors should be propagated instead of silently failing
			// This ensures calling code knows initialization failed and can respond appropriately
			throw new Error(`Conversation memory startup failed: ${errorMessage}`)
		}
	}

	public stop(): void {
		if (this.stateManager.state !== "Error") this.stateManager.setSystemState("Standby", "")
		try {
			this.retention?.stop()
		} catch {}
	}

	/**
	 * Clears all conversation memory data for this workspace.
	 * Attempts to clear/delete the vector collection and removes on-disk artifacts.
	 */
	public async clearMemoryData(): Promise<void> {
		// CRITICAL FIX: Ensure initialization completes before any operations
		await this.ensureInitialized()

		try {
			// Prefer deleteCollection, fallback to clearCollection
			if (typeof (this.vectorStore as any).deleteCollection === "function") {
				await (this.vectorStore as any).deleteCollection()
			} else if (typeof (this.vectorStore as any).clearCollection === "function") {
				await (this.vectorStore as any).clearCollection()
			}
		} catch (e) {
			console.error(
				"[ConversationMemoryOrchestrator] Failed to clear vector collection:",
				(e as any)?.message || e,
			)
		}

		// Remove on-disk artifacts (.roo-memory)
		try {
			const artifactsDir = require("path").join(this.workspacePath, ".roo-memory")
			await require("fs/promises").rm(artifactsDir, { recursive: true, force: true })
		} catch (e) {
			// best-effort
		}

		this.stateManager.setSystemState("Standby", "Conversation memory cleared successfully.")
	}

	public async search(query: string) {
		// CRITICAL FIX: Ensure initialization completes before any operations
		await this.ensureInitialized()
		return this.searchSvc.search(query)
	}

	public async searchEpisodes(query: string, limit: number = 5) {
		// CRITICAL FIX: Ensure initialization completes before any operations
		await this.ensureInitialized()
		return this.searchSvc.searchEpisodes(query, limit)
	}

	/**
	 * Collects a message for episode processing. This is the new entry point
	 * that replaces processTurn() with proper episode-based background processing.
	 */
	public async collectMessage(message: Message): Promise<void> {
		// CRITICAL FIX: Ensure initialization completes before any operations
		await this.ensureInitialized()

		if (!this.episodeDetector) {
			const error = new Error("Episode detector not available - conversation memory collection disabled")
			console.warn("[ConversationMemoryOrchestrator]", error.message)
			this.stateManager.setSystemState(
				"Error",
				"Memory collection unavailable - episode detection not configured",
			)
			return
		}

		// Validate message before adding to buffer
		if (!message || !message.content) {
			const error = new Error("Invalid message provided to collectMessage - missing content")
			console.error("[ConversationMemoryOrchestrator]", error.message)
			throw error
		}

		this.messageBuffer.push(message)

		// Trigger background processing (non-blocking)
		if (!this.processingInProgress) {
			setImmediate(() => this.processMessagesInBackground())
		}
	}

	/**
	 * Background processing that doesn't block the UI
	 */
	private async processMessagesInBackground(): Promise<void> {
		if (this.processingInProgress || !this.episodeDetector) return

		this.processingInProgress = true

		try {
			// Only process if we have enough messages for meaningful episodes
			if (this.messageBuffer.length >= 4) {
				await this.processBufferedMessages()
			}
		} catch (error) {
			console.error("[ConversationMemoryOrchestrator] Background processing failed:", error)

			// Set error state to inform users instead of silent failure
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.includes("ECONNREFUSED") || errorMessage.includes("connect")) {
				this.stateManager.setSystemState("Error", "Memory service offline - check Qdrant connection")
			} else if (errorMessage.includes("API key") || errorMessage.includes("Unauthorized")) {
				this.stateManager.setSystemState("Error", "Memory service authentication failed - check API keys")
			} else if (errorMessage.includes("timeout")) {
				this.stateManager.setSystemState("Error", "Memory service timeout - processing delayed")
			} else {
				this.stateManager.setSystemState("Error", `Memory processing failed: ${errorMessage}`)
			}
		} finally {
			this.processingInProgress = false
		}
	}

	/**
	 * Process collected messages into episodes and extract facts
	 */
	private async processBufferedMessages(): Promise<void> {
		if (!this.episodeDetector || this.messageBuffer.length === 0) return

		try {
			const project = await this.detectProjectContext()

			// Detect episodes from buffered messages
			const episodes = await this.episodeDetector.detect(this.messageBuffer, this.workspacePath, project)

			// Process each episode
			for (const episode of episodes) {
				try {
					await this.processEpisode(episode)
				} catch (episodeError) {
					console.error(
						`[ConversationMemoryOrchestrator] Failed to process episode ${episode.episode_id}:`,
						episodeError,
					)
					// Continue with other episodes rather than failing completely
					// But set a warning state so users know processing is degraded
					this.stateManager.setSystemState("Error", `Some memory processing failed - check logs`)
				}
			}

			// Clear processed messages from buffer
			this.messageBuffer = []
		} catch (error) {
			console.error("[ConversationMemoryOrchestrator] Failed to process episodes:", error)

			// Provide specific error context instead of generic failure
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.includes("LLM") || errorMessage.includes("API")) {
				throw new Error(`Episode processing failed due to LLM service error: ${errorMessage}`)
			} else if (errorMessage.includes("embedding")) {
				throw new Error(`Episode processing failed due to embedding service error: ${errorMessage}`)
			} else {
				throw new Error(`Episode processing failed: ${errorMessage}`)
			}
		}
	}

	public async processEpisode(episode: ConversationEpisode): Promise<void> {
		const project = await this.detectProjectContext()
		const extractor = new ConversationFactExtractor(this.llm)
		const inputs = await extractor.extractFacts(episode.messages, project)

		// PERFORMANCE FIX: Batch process facts instead of sequential processing
		await this.ingestFactsBatch(
			inputs.map((input) => ({
				...input,
				reference_time: input.reference_time ?? episode.reference_time,
				context_description: input.context_description ?? episode.context_description,
				episode_id: episode.episode_id,
				episode_context: episode.context_description,
			})),
		)
	}

	/**
	 * Immediate, turn-level processing. Extracts lightweight facts from the recent
	 * messages (sliding window) and ingests them immediately with minimal metadata.
	 */
	public async processTurn(
		messages: Message[],
		llmOverride?: ILlmProvider,
		meta?: {
			modelId?: string
			toolMeta?: { name: string; params: any; resultText?: string }
			fullHistory?: Message[]
		},
	): Promise<void> {
		// PERFORMANCE FIX: Removed excessive debug logging
		if (!messages || messages.length === 0) {
			return
		}

		const project = await this.detectProjectContext()

		// Determine episode for this turn using full conversation history when provided
		let episodeForTurn: { id?: string; context?: string } | undefined
		try {
			// Only run episode detection when a full history was explicitly provided.
			if (meta?.fullHistory && Array.isArray(meta.fullHistory) && meta.fullHistory.length > 0) {
				const ep = await this.detectEpisodeForTurn(meta.fullHistory, project, llmOverride)
				if (ep) {
					episodeForTurn = { id: ep.episode_id, context: ep.context_description }
				}
			}
		} catch (e) {
			// Reduced logging - only warn on actual failures
		}

		const extractor = new ConversationFactExtractor(this.llm)
		// Keep a small window (defaults to last 5 messages)
		let window = messages.slice(-5)
		// Append TOOL and TOOL_OUT lines as synthetic assistant message (simplified - no token budgets)
		if (meta?.toolMeta) {
			// Simple tool formatting without complex budgeting
			const toolLines = [
				`TOOL: ${meta.toolMeta.name}(${JSON.stringify(meta.toolMeta.params || {})})`,
				...(meta.toolMeta.resultText ? [`TOOL_OUT: ${meta.toolMeta.resultText}`] : []),
			]
			if (toolLines.length) {
				window = [...window, { role: "assistant", content: toolLines.join("\n") }]
			}
		}

		let inputs: CategorizedFactInput[] = []
		try {
			if (llmOverride) {
				inputs = await extractor.extractFactsWithProvider(window, project, llmOverride)
			} else if (this.llm) {
				inputs = await extractor.extractFacts(window, project)
			} else {
				// No provider available; skip
				inputs = []
			}
		} catch (error) {
			console.error("[ConversationMemoryOrchestrator] Failed to extract facts:", error)

			// Provide specific error context for fact extraction failures
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.includes("LLM") || errorMessage.includes("API")) {
				throw new Error(`Fact extraction failed due to LLM service error: ${errorMessage}`)
			} else if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
				throw new Error(`Fact extraction failed due to network error: ${errorMessage}`)
			} else {
				throw new Error(`Fact extraction failed: ${errorMessage}`)
			}
		}

		if (inputs.length === 0) return

		const now = new Date()
		// PERFORMANCE FIX: Use batch processing instead of sequential processing
		try {
			await this.ingestFactsBatch(
				inputs.map((input) => ({
					...input,
					reference_time: input.reference_time ?? now,
					context_description:
						input.context_description ?? episodeForTurn?.context ?? "Turn-level extraction",
					source_model: meta?.modelId,
					episode_id: episodeForTurn?.id,
					episode_context: episodeForTurn?.context,
				})),
			)
		} catch (error) {
			console.error("[ConversationMemoryOrchestrator] Failed to ingest facts batch:", error)

			// For critical infrastructure errors, propagate them so the caller knows
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.includes("embed") || errorMessage.includes("Embedding")) {
				// Embedding service failures are critical - throw to inform caller
				throw new Error(`Critical error: Embedding service failed during fact processing: ${errorMessage}`)
			} else if (
				errorMessage.includes("vector") ||
				errorMessage.includes("store") ||
				errorMessage.includes("ECONNREFUSED")
			) {
				// Vector store failures are critical - throw to inform caller
				throw new Error(`Critical error: Vector store failed during fact processing: ${errorMessage}`)
			}

			// For non-critical errors, set state and continue
			if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
				this.stateManager.setSystemState("Error", "Memory service intermittent - some facts may be lost")
			} else {
				this.stateManager.setSystemState("Error", "Memory processing degraded - check logs")
			}
		}
	}

	private async detectEpisodeForTurn(fullMessages: Message[], project: ProjectContext, llmOverride?: ILlmProvider) {
		try {
			// Build hints provider and context generator on-demand using the override LLM
			const hintsProvider = this.createHintsProvider()
			const llm = llmOverride || this.llm
			if (!llm) return undefined
			const ctxGen = new EpisodeContextGenerator(llm, hintsProvider)
			const detector = new EpisodeDetector(ctxGen, this.embedder, llm, this.episodeConfig)
			const episodes = await detector.detect(fullMessages, this.workspacePath, project)
			if (!episodes || episodes.length === 0) return undefined
			return episodes[episodes.length - 1]
		} catch (e) {
			return undefined
		}
	}

	public async getEpisodeDetails(episodeId: string, limit: number = 5) {
		try {
			// Pull all facts for this episode within this workspace
			const res = (await (this.vectorStore.filter
				? this.vectorStore.filter(200, { workspace_path: this.workspacePath, episode_id: episodeId } as any)
				: [])) as any
			const facts: any[] = Array.isArray(res)
				? res.map((r: any) => r.payload)
				: (res.records || []).map((r: any) => r.payload)
			if (!facts.length) return undefined
			// Compute timeframe
			const times = facts
				.map((f) => new Date(f.reference_time).getTime())
				.filter((t) => !isNaN(t))
				.sort()
			const timeframe = times.length
				? new Date(times[0]).toLocaleDateString() +
					(times.length > 1 ? ` - ${new Date(times[times.length - 1]).toLocaleDateString()}` : "")
				: ""
			// Sort by temporal score (with confidence) descending
			const scored = facts
				.map((f) => ({ f, s: this.temporal.score(f) }))
				.sort((a, b) => b.s - a.s)
				.slice(0, Math.max(1, Math.min(20, limit)))
			return {
				episode_context: facts[0]?.episode_context || facts[0]?.context_description,
				timeframe,
				facts: scored.map((x) => x.f),
			}
		} catch {
			return undefined
		}
	}

	private async ingestFact(fact: CategorizedFactInput): Promise<void> {
		try {
			// Ensure we have an embedding
			const embedding = fact.embedding ?? (await this.embedder.embed(fact.content))
			const withEmbedding: CategorizedFactInput = { ...fact, embedding }

			const resolver = new ConflictResolver(this.vectorStore, this.workspacePath)
			const actions = await resolver.resolve(withEmbedding)

			for (const a of actions) {
				if (a.type === "IGNORE") continue
				if (a.type === "DELETE_EXISTING") {
					for (const id of a.target_ids ?? []) await this.vectorStore.delete(id)
					continue
				}
				if (a.type === "UPDATE") {
					const id = a.target_ids?.[0]
					if (id) await this.vectorStore.update(id, null, { ...a.fact, updated_at: new Date().toISOString() })
					continue
				}
				if (a.type === "SUPERSEDE") {
					const newId = await this.insertNew(withEmbedding)
					const now = new Date().toISOString()
					for (const id of a.target_ids ?? []) {
						const existing = await this.vectorStore.get(id)
						await this.vectorStore.update(id, null, {
							...(existing?.payload || {}),
							superseded_by: newId,
							superseded_at: now,
						})
					}
					continue
				}
				if (a.type === "ADD") {
					await this.insertNew(withEmbedding)
				}
			}
		} catch (error) {
			console.error("[ConversationMemoryOrchestrator] ingestFact failed:", error)
			throw error
		}
	}

	/**
	 * PERFORMANCE FIX: Batch process multiple facts to reduce API calls
	 */
	private async ingestFactsBatch(facts: CategorizedFactInput[]): Promise<void> {
		if (facts.length === 0) return

		try {
			// Separate facts with and without embeddings
			const factsWithEmbeddings: CategorizedFactInput[] = []
			const factsNeedingEmbeddings: CategorizedFactInput[] = []

			for (const fact of facts) {
				if (fact.embedding) {
					factsWithEmbeddings.push(fact)
				} else {
					factsNeedingEmbeddings.push(fact)
				}
			}

			// Batch embed facts that need embeddings
			let newlyEmbeddedFacts: CategorizedFactInput[] = []
			if (factsNeedingEmbeddings.length > 0) {
				const contents = factsNeedingEmbeddings.map((f) => f.content)
				const embeddings = await this.embedder.embedBatch(contents)

				newlyEmbeddedFacts = factsNeedingEmbeddings.map((fact, index) => ({
					...fact,
					embedding: embeddings[index],
				}))
			}

			// Combine all facts with embeddings
			const allFactsWithEmbeddings = [...factsWithEmbeddings, ...newlyEmbeddedFacts]

			// Process each fact through conflict resolution
			// Note: Conflict resolution is inherently sequential due to dependencies
			for (const fact of allFactsWithEmbeddings) {
				const resolver = new ConflictResolver(this.vectorStore, this.workspacePath)
				const actions = await resolver.resolve(fact)

				for (const a of actions) {
					if (a.type === "IGNORE") continue
					if (a.type === "DELETE_EXISTING") {
						for (const id of a.target_ids ?? []) await this.vectorStore.delete(id)
						continue
					}
					if (a.type === "UPDATE") {
						const id = a.target_ids?.[0]
						if (id)
							await this.vectorStore.update(id, null, { ...a.fact, updated_at: new Date().toISOString() })
						continue
					}
					if (a.type === "SUPERSEDE") {
						const newId = await this.insertNew(fact)
						const now = new Date().toISOString()
						for (const id of a.target_ids ?? []) {
							const existing = await this.vectorStore.get(id)
							await this.vectorStore.update(id, null, {
								...(existing?.payload || {}),
								superseded_by: newId,
								superseded_at: now,
							})
						}
						continue
					}
					if (a.type === "ADD") {
						await this.insertNew(fact)
					}
				}
			}
		} catch (error) {
			console.error("[ConversationMemoryOrchestrator] ingestFactsBatch failed:", error)
			throw error
		}
	}

	private async insertNew(fact: CategorizedFactInput): Promise<string> {
		const id = this.generateId(fact)
		await this.vectorStore.insert(
			[fact.embedding as number[]],
			[id],
			[
				{
					...fact,
					ingestion_time: new Date().toISOString(),
					workspace_path: this.workspacePath,
				},
			],
		)
		return id
	}

	private generateId(f: CategorizedFactInput): string {
		return (
			require("crypto").randomUUID?.() ||
			require("crypto")
				.createHash("sha256")
				.update(`${this.workspacePath}:${f.category}:${f.content}:${Date.now()}`)
				.digest("hex")
		)
	}

	private collectionName(): string {
		const hash = require("crypto").createHash("sha256").update(this.workspacePath).digest("hex")
		return `ws-${hash.substring(0, 16)}-memory`
	}

	private async detectProjectContext(): Promise<ProjectContext> {
		const workspaceName = path.basename(this.workspacePath)
		let language: string = "typescript"
		let framework: string | undefined
		let packageManager: string | undefined

		try {
			const pkgPath = path.join(this.workspacePath, "package.json")
			const raw = await fs.readFile(pkgPath, "utf-8").catch(() => undefined)
			if (raw) {
				const pkg = JSON.parse(raw)
				const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
				if (
					!("typescript" in (pkg.devDependencies || {})) &&
					!(await this.fileExists(path.join(this.workspacePath, "tsconfig.json")))
				) {
					language = "javascript"
				}
				const frameworks = [
					"next",
					"react",
					"vue",
					"nuxt",
					"svelte",
					"angular",
					"nest",
					"express",
					"fastify",
					"koa",
					"astro",
				]
				framework = frameworks.find((f) => deps[f])
				packageManager = typeof pkg.packageManager === "string" ? pkg.packageManager.split("@")[0] : undefined
			}

			if (!packageManager) {
				if (await this.fileExists(path.join(this.workspacePath, "pnpm-lock.yaml"))) packageManager = "pnpm"
				else if (await this.fileExists(path.join(this.workspacePath, "yarn.lock"))) packageManager = "yarn"
				else if (await this.fileExists(path.join(this.workspacePath, "package-lock.json")))
					packageManager = "npm"
			}
		} catch {
			// ignore
		}

		try {
			const pyprojectPath = path.join(this.workspacePath, "pyproject.toml")
			const requirementsPath = path.join(this.workspacePath, "requirements.txt")
			const hasPyproject = await this.fileExists(pyprojectPath)
			const hasRequirements = await this.fileExists(requirementsPath)

			if (hasPyproject || hasRequirements) {
				language = "python"

				// Detect framework from requirements.txt
				const req = await fs.readFile(requirementsPath, "utf-8").catch(() => "")
				if (/fastapi/i.test(req)) framework = "fastapi"
				else if (/django/i.test(req)) framework = "django"
				else if (/flask/i.test(req)) framework = "flask"

				// Properly detect Python package managers instead of hardcoded pip fallback
				if (!packageManager) {
					// Check for uv first (most specific)
					if (hasPyproject) {
						const pyprojectContent = await fs.readFile(pyprojectPath, "utf-8").catch(() => "")
						if (pyprojectContent.includes("[tool.uv")) {
							packageManager = "uv"
						} else if (pyprojectContent.includes("[tool.poetry")) {
							packageManager = "poetry"
						} else if (pyprojectContent.includes("[tool.pdm")) {
							packageManager = "pdm"
						}
					}

					// Check for lock files if not detected from pyproject.toml
					if (!packageManager) {
						if (await this.fileExists(path.join(this.workspacePath, "uv.lock"))) {
							packageManager = "uv"
						} else if (await this.fileExists(path.join(this.workspacePath, "poetry.lock"))) {
							packageManager = "poetry"
						} else if (await this.fileExists(path.join(this.workspacePath, "pdm.lock"))) {
							packageManager = "pdm"
						} else if (await this.fileExists(path.join(this.workspacePath, "Pipfile"))) {
							packageManager = "pipenv"
						}
					}
				}
			} else if (await this.fileExists(path.join(this.workspacePath, "Cargo.toml"))) {
				language = "rust"
				packageManager = "cargo"
			} else if (await this.fileExists(path.join(this.workspacePath, "go.mod"))) {
				language = "go"
				packageManager = "go"
			}
		} catch {}

		return { workspaceName, language, framework, packageManager }
	}

	private async fileExists(p: string): Promise<boolean> {
		try {
			await fs.access(p)
			return true
		} catch {
			return false
		}
	}
}

// --- Helpers for TOOL lines, token budgets, and artifacts ---

function isHighSignalTool(name: string): boolean {
	return ["use_mcp_tool", "access_mcp_resource", "codebase_search", "execute_command"].includes(name)
}

function isFileEditingTool(name: string): boolean {
	return ["write_to_file", "apply_diff", "insert_content", "search_and_replace"].includes(name)
}

// Complex artifact persistence functions removed for simplified mode
// Following Phase 3A strategy - removed over-engineered systems for reliability

export type FilesIndexedUpdate = { path: string; newHash?: string; status: string }

export async function resolveFileRefUpdates(
	vectorStore: IVectorStore,
	workspacePath: string,
	updates: FilesIndexedUpdate[],
): Promise<void> {
	for (const u of updates) {
		try {
			// Find facts referencing this path
			const res = (await (vectorStore.filter
				? vectorStore.filter(1000, { "metadata.file_path": u.path, workspace_path: workspacePath } as any)
				: [])) as any
			const records: Array<{ id: string; payload: any }> = Array.isArray(res)
				? res.map((r: any) => ({ id: r.id, payload: r.payload }))
				: (res.records || []).map((r: any) => ({ id: r.id, payload: r.payload }))

			for (const rec of records) {
				const md = rec.payload?.metadata || {}
				const currentHash = md.code_index_hash || md.file_hash
				let newMetadata = { ...md }
				if (u.newHash) {
					// If pending, resolve; if indexed with different hash, mark stale
					if (md.ref_status === "pending") {
						newMetadata = { ...md, ref_status: "indexed", code_index_hash: u.newHash, stale: false }
					} else if (currentHash && currentHash !== u.newHash) {
						newMetadata = { ...md, stale: true }
					}
				} else if (u.status === "success") {
					// Likely deletion case
					newMetadata = { ...md, stale: true, deleted: true }
				}
				await vectorStore.update(rec.id, null, {
					...rec.payload,
					metadata: newMetadata,
					updated_at: new Date().toISOString(),
				})
			}
		} catch {
			// best-effort; non-fatal
		}
	}
}

export async function handleFilesIndexed(
	orchestrator: ConversationMemoryOrchestrator,
	updates: Array<{ path: string; newHash?: string; status: string; op?: "index" | "delete" | "change" }>,
): Promise<void> {
	const vector = (orchestrator as any)["vectorStore"] as IVectorStore
	const embedder = (orchestrator as any)["embedder"] as IEmbedder
	const workspacePath = (orchestrator as any)["workspacePath"] as string
	if (!vector || !embedder) return

	const deletes = updates.filter((u) => u.op === "delete").map((u) => u.path)
	const indexes = updates.filter((u) => u.op === "index" && u.newHash)

	// Handle deletions: supersede related facts
	for (const delPath of deletes) {
		try {
			const res = (await (vector.filter
				? vector.filter(1000, { "metadata.file_path": delPath, workspace_path: workspacePath } as any)
				: [])) as any
			const recs: Array<{ id: string; payload: any }> = Array.isArray(res)
				? res.map((r: any) => ({ id: r.id, payload: r.payload }))
				: (res.records || []).map((r: any) => ({ id: r.id, payload: r.payload }))

			if (recs.length === 0) continue
			const content = `File deleted: ${delPath}`
			const emb = await embedder.embed(content)
			const newId =
				require("crypto").randomUUID?.() ||
				require("crypto").createHash("sha256").update(`${workspacePath}:${content}:${Date.now()}`).digest("hex")
			await vector.insert(
				[emb],
				[newId],
				[
					{
						content,
						category: "pattern",
						confidence: 0.5,
						reference_time: new Date(),
						ingestion_time: new Date(),
						workspace_path: workspacePath,
						metadata: { file_path: delPath, deleted: true },
					},
				],
			)
			const now = new Date().toISOString()
			for (const rec of recs) {
				const payload = { ...(rec.payload || {}) }
				payload.metadata = { ...(payload.metadata || {}), stale: true, deleted: true }
				payload.superseded_by = newId
				payload.superseded_at = now
				await vector.update(rec.id, null, payload)
			}
		} catch {
			// non-fatal
		}
	}

	// Handle probable renames: if an indexed file has newHash that matches existing facts with different file_path
	for (const idx of indexes) {
		try {
			const newHash = idx.newHash!
			const res = (await (vector.filter
				? vector.filter(1000, { "metadata.file_hash": newHash, workspace_path: workspacePath } as any)
				: [])) as any
			const recs: Array<{ id: string; payload: any }> = Array.isArray(res)
				? res.map((r: any) => ({ id: r.id, payload: r.payload }))
				: (res.records || []).map((r: any) => ({ id: r.id, payload: r.payload }))

			for (const rec of recs) {
				const oldPath = rec.payload?.metadata?.file_path
				if (oldPath && oldPath !== idx.path) {
					// Consider this a rename oldPath -> idx.path
					const content = `File renamed: ${oldPath} → ${idx.path}`
					const emb = await embedder.embed(content)
					const newId =
						require("crypto").randomUUID?.() ||
						require("crypto")
							.createHash("sha256")
							.update(`${workspacePath}:${content}:${Date.now()}`)
							.digest("hex")
					await vector.insert(
						[emb],
						[newId],
						[
							{
								content,
								category: "pattern",
								confidence: 0.6,
								reference_time: new Date(),
								ingestion_time: new Date(),
								workspace_path: workspacePath,
								metadata: { from: oldPath, to: idx.path, file_hash: newHash, rename: true },
							},
						],
					)
					const now = new Date().toISOString()
					const payload = { ...(rec.payload || {}) }
					payload.metadata = { ...(payload.metadata || {}), stale: true, renamed: true, new_path: idx.path }
					payload.superseded_by = newId
					payload.superseded_at = now
					await vector.update(rec.id, null, payload)
				}
			}
		} catch {
			// non-fatal
		}
	}
}
