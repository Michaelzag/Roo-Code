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

	// CRITICAL FIX: Track initialization state to prevent race conditions
	private isInitialized = false
	private initializationPromise: Promise<void> | null = null

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

	private async performInitialization(): Promise<void> {
		console.log("[ConversationMemoryOrchestrator] Starting orchestrator", {
			workspacePath: this.workspacePath,
			embedderDimension: this.embedder.dimension,
		})

		try {
			// Ensure collection exists
			const collectionName = this.collectionName()
			console.log("[ConversationMemoryOrchestrator] About to ensure collection", {
				collectionName: collectionName,
				embedderDimension: this.embedder.dimension,
			})

			await this.vectorStore.ensureCollection(collectionName, this.embedder.dimension)

			console.log("[ConversationMemoryOrchestrator] Collection ensured successfully", {
				collectionName: collectionName,
			})

			this.stateManager.setSystemState("Indexed", "Conversation memory ready")

			console.log("[ConversationMemoryOrchestrator] Start completed successfully")
		} catch (error: any) {
			const errorMessage = error?.message || String(error)
			console.error("[ConversationMemoryOrchestrator] Failed to start:", errorMessage)
			console.error("[ConversationMemoryOrchestrator] Error details:", {
				workspacePath: this.workspacePath,
				collectionName: this.collectionName(),
				embedderDimension: this.embedder.dimension,
				errorStack: error?.stack,
			})

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

		for (const input of inputs) {
			await this.ingestFact({
				...input,
				reference_time: input.reference_time ?? episode.reference_time,
				context_description: input.context_description ?? episode.context_description,
				episode_id: episode.episode_id,
				episode_context: episode.context_description,
			})
		}
	}

	/**
	 * Immediate, turn-level processing. Extracts lightweight facts from the recent
	 * messages (sliding window) and ingests them immediately with minimal metadata.
	 */
	public async processTurn(
		messages: Message[],
		llmOverride?: ILlmProvider,
		meta?: { modelId?: string; toolMeta?: { name: string; params: any; resultText?: string } },
	): Promise<void> {
		// Process turn for conversation memory

		if (!messages || messages.length === 0) {
			return
		}

		const project = await this.detectProjectContext()
		const extractor = new ConversationFactExtractor(this.llm)
		// Keep a small window (defaults to last 5 messages)
		let window = messages.slice(-5)
		// Append TOOL and TOOL_OUT lines as synthetic assistant message with token budgets
		if (meta?.toolMeta) {
			const toolLines = buildToolLines(meta.toolMeta)
			if (toolLines && toolLines.length) {
				window = applyTokenBudgets(window, toolLines)
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
		const now = new Date()
		for (let i = 0; i < inputs.length; i++) {
			const input = inputs[i]
			try {
				await this.ingestFact({
					...input,
					reference_time: input.reference_time ?? now,
					context_description: input.context_description ?? "Turn-level extraction",
					source_model: meta?.modelId,
				})
			} catch (error) {
				console.error("[ConversationMemoryOrchestrator] Failed to ingest fact:", error)

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

				// For non-critical errors, set state and continue with other facts
				if (errorMessage.includes("network") || errorMessage.includes("timeout")) {
					this.stateManager.setSystemState("Error", "Memory service intermittent - some facts may be lost")
				} else {
					this.stateManager.setSystemState("Error", "Memory processing degraded - check logs")
				}

				console.warn(
					`[ConversationMemoryOrchestrator] Fact ingestion degraded - content: "${input.content.substring(0, 50)}..."`,
				)
			}
		}

		// Persist artifact & digest for high-signal tools
		if (meta?.toolMeta && shouldPersistArtifact(meta.toolMeta.name) && meta.toolMeta.resultText) {
			try {
				const { artifactPath, hash } = await persistArtifact(this.workspacePath, meta.toolMeta)
				const digestText = buildArtifactDigest(meta.toolMeta)
				const digest: CategorizedFactInput = {
					content:
						digestText ||
						`Tool ${meta.toolMeta.name} output captured (artifact=${artifactPath}, hash=${hash})`,
					category: "pattern",
					confidence: 0.6,
					context_description: "Tool output digest",
					source_model: meta?.modelId,
					metadata: {
						artifact_path: artifactPath,
						tool: { name: meta.toolMeta.name, params: safeMinify(meta.toolMeta.params) },
						artifact_hash: hash,
						data_source: "mcp",
						persistent: true,
					},
				}
				await this.ingestFact(digest)
			} catch (e) {
				console.warn("[ConversationMemory] Artifact persistence failed:", (e as any)?.message || e)
			}
		}

		// Create pending file reference facts for file-editing tools
		if (meta?.toolMeta && isFileEditingTool(meta.toolMeta.name)) {
			const paths = extractFilePaths(meta.toolMeta)
			for (const p of paths) {
				try {
					const fileHash = await computeFileHash(this.workspacePath, p)
					const fact: CategorizedFactInput = {
						content: `File changed: ${p}`,
						category: "pattern",
						confidence: 0.5,
						context_description: "File change reference",
						source_model: meta?.modelId,
						metadata: { file_path: p, file_hash: fileHash, ref_status: "pending" },
					}
					await this.ingestFact(fact)
				} catch {
					// ignore missing file or hash errors
				}
			}
		}
	}

	private async ingestFact(fact: CategorizedFactInput): Promise<void> {
		console.log("[ConversationMemoryOrchestrator] ingestFact called", {
			factContent: fact.content.substring(0, 100),
			factCategory: fact.category,
			hasEmbedding: !!fact.embedding,
			workspacePath: this.workspacePath,
		})

		try {
			// Ensure we have an embedding
			const embedding = fact.embedding ?? (await this.embedder.embed(fact.content))
			const withEmbedding: CategorizedFactInput = { ...fact, embedding }

			console.log("[ConversationMemoryOrchestrator] About to resolve conflicts", {
				embeddingLength: embedding?.length,
				workspacePath: this.workspacePath,
			})

			const resolver = new ConflictResolver(this.vectorStore, this.workspacePath)
			const actions = await resolver.resolve(withEmbedding)

			console.log("[ConversationMemoryOrchestrator] Conflict resolution completed", {
				actionCount: actions.length,
				actionTypes: actions.map((a) => a.type),
			})

			for (const a of actions) {
				console.log("[ConversationMemoryOrchestrator] Processing action", {
					actionType: a.type,
					targetIds: a.target_ids,
				})

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
					console.log("[ConversationMemoryOrchestrator] Adding new fact via insertNew")
					await this.insertNew(withEmbedding)
				}
			}

			console.log("[ConversationMemoryOrchestrator] ingestFact completed successfully")
		} catch (error) {
			console.error("[ConversationMemoryOrchestrator] ingestFact failed:", error)
			console.error("[ConversationMemoryOrchestrator] ingestFact error details:", {
				factContent: fact.content.substring(0, 100),
				workspacePath: this.workspacePath,
				errorMessage: error instanceof Error ? error.message : String(error),
				errorStack: error instanceof Error ? error.stack : undefined,
			})
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

		console.log("[ConversationMemoryOrchestrator] DEBUG: Starting detectProjectContext", {
			workspacePath: this.workspacePath,
			workspaceName,
		})

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
				console.log("[ConversationMemoryOrchestrator] DEBUG: Processed package.json", {
					hasPackageJson: true,
					packageManagerFromJson: packageManager,
				})
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

			console.log("[ConversationMemoryOrchestrator] DEBUG: Checking Python files", {
				hasPyproject,
				hasRequirements,
				currentPackageManager: packageManager,
			})

			if (hasPyproject || hasRequirements) {
				language = "python"

				// Detect framework from requirements.txt
				const req = await fs.readFile(requirementsPath, "utf-8").catch(() => "")
				if (/fastapi/i.test(req)) framework = "fastapi"
				else if (/django/i.test(req)) framework = "django"
				else if (/flask/i.test(req)) framework = "flask"

				// CRITICAL FIX: Properly detect Python package managers instead of hardcoded pip fallback
				if (!packageManager) {
					console.log("[ConversationMemoryOrchestrator] DEBUG: Detecting Python package manager")

					// Check for uv first (most specific)
					if (hasPyproject) {
						const pyprojectContent = await fs.readFile(pyprojectPath, "utf-8").catch(() => "")
						if (pyprojectContent.includes("[tool.uv")) {
							packageManager = "uv"
							console.log(
								"[ConversationMemoryOrchestrator] DEBUG: Detected uv from [tool.uv] in pyproject.toml",
							)
						} else if (pyprojectContent.includes("[tool.poetry")) {
							packageManager = "poetry"
							console.log(
								"[ConversationMemoryOrchestrator] DEBUG: Detected poetry from [tool.poetry] in pyproject.toml",
							)
						} else if (pyprojectContent.includes("[tool.pdm")) {
							packageManager = "pdm"
							console.log(
								"[ConversationMemoryOrchestrator] DEBUG: Detected pdm from [tool.pdm] in pyproject.toml",
							)
						}
					}

					// Check for lock files if not detected from pyproject.toml
					if (!packageManager) {
						if (await this.fileExists(path.join(this.workspacePath, "uv.lock"))) {
							packageManager = "uv"
							console.log("[ConversationMemoryOrchestrator] DEBUG: Detected uv from uv.lock file")
						} else if (await this.fileExists(path.join(this.workspacePath, "poetry.lock"))) {
							packageManager = "poetry"
							console.log("[ConversationMemoryOrchestrator] DEBUG: Detected poetry from poetry.lock file")
						} else if (await this.fileExists(path.join(this.workspacePath, "pdm.lock"))) {
							packageManager = "pdm"
							console.log("[ConversationMemoryOrchestrator] DEBUG: Detected pdm from pdm.lock file")
						} else if (await this.fileExists(path.join(this.workspacePath, "Pipfile"))) {
							packageManager = "pipenv"
							console.log("[ConversationMemoryOrchestrator] DEBUG: Detected pipenv from Pipfile")
						}
					}

					// CRITICAL: DO NOT default to pip - leave undefined if unknown
					console.log("[ConversationMemoryOrchestrator] DEBUG: Final Python package manager detection", {
						detected: packageManager,
						removedHardcodedPipFallback: true,
					})
				}
			} else if (await this.fileExists(path.join(this.workspacePath, "Cargo.toml"))) {
				language = "rust"
				packageManager = "cargo"
			} else if (await this.fileExists(path.join(this.workspacePath, "go.mod"))) {
				language = "go"
				packageManager = "go"
			}
		} catch {}

		const result = { workspaceName, language, framework, packageManager }
		console.log("[ConversationMemoryOrchestrator] DEBUG: Final detectProjectContext result", result)
		return result
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

function shouldPersistArtifact(name: string): boolean {
	return isHighSignalTool(name)
}

function buildToolLines(toolMeta: { name: string; params: any; resultText?: string }): string[] | null {
	const lines: string[] = []
	const params = safeMinify(toolMeta.params)
	lines.push(`TOOL: ${toolMeta.name}(${params ? JSON.stringify(params) : ""})`)
	if (isHighSignalTool(toolMeta.name) && toolMeta.resultText) {
		const out = sanitizeOutput(toolMeta.resultText)
		lines.push("BEGIN_TOOL_OUTPUT")
		lines.push(out)
		lines.push("END_TOOL_OUTPUT")
	}
	return lines
}

function sanitizeOutput(text: string): string {
	let t = text || ""
	// strip code fences
	t = t.replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, ""))
	// strip ANSI escapes
	t = stripAnsi(t)
	// redact obvious secrets
	t = t.replace(/(api[_-]?key|token|password|secret|bearer)\s*[:=]\s*[^\s'";]+/gi, "$1=[REDACTED]")
	// redact .env style
	t = t.replace(/^([A-Z0-9_]+)=(.+)$/gm, "$1=[REDACTED]")
	return t.trim()
}

function safeMinify(obj: any): any {
	try {
		return JSON.parse(JSON.stringify(obj))
	} catch {
		return undefined
	}
}

function safeCountTokens(text: string): number {
	// Approximate tokens as chars/4; avoids async tiktoken in this path
	return Math.ceil((text || "").length / 4)
}

function trimToTokenBudget(text: string, budget: number): string {
	if (!text) return ""
	let low = 0
	let high = text.length
	let best = ""
	// binary search by char length to approximate token budget
	while (low <= high) {
		const mid = Math.floor((low + high) / 2)
		const slice = text.slice(0, mid)
		const tok = safeCountTokens(slice)
		if (tok <= budget) {
			best = slice
			low = mid + 1
		} else {
			high = mid - 1
		}
	}
	if (best.length < text.length) return best + "\n[truncated]"
	return best
}

function applyTokenBudgets(window: Message[], toolLines: string[]): Message[] {
	const TOTAL = 2000
	const MCP_BUDGET = 1200
	const CBS_BUDGET = 800
	const EXEC_BUDGET = 600

	const winText = window.map((m) => `${m.role.toUpperCase()}: ${m.content}`)
	let winTokens = safeCountTokens(winText.join("\n"))

	let lines = [...toolLines]
	const firstLine = lines[0] || ""
	let toolBudget = 600
	if (firstLine.includes("use_mcp_tool") || firstLine.includes("access_mcp_resource")) toolBudget = MCP_BUDGET
	else if (firstLine.includes("codebase_search")) toolBudget = CBS_BUDGET
	else if (firstLine.includes("execute_command")) toolBudget = EXEC_BUDGET

	const hasOut = lines.includes("BEGIN_TOOL_OUTPUT")
	if (hasOut) {
		const begin = lines.indexOf("BEGIN_TOOL_OUTPUT")
		const end = lines.lastIndexOf("END_TOOL_OUTPUT")
		if (begin >= 0 && end > begin) {
			const out = lines.slice(begin + 1, end).join("\n")
			const trimmed = trimToTokenBudget(out, toolBudget)
			lines = [...lines.slice(0, begin + 1), trimmed, ...lines.slice(end)]
		}
	}

	const toolTokens = safeCountTokens(lines.join("\n"))
	let total = winTokens + toolTokens
	let resultWindow = [...window]
	if (total > TOTAL) {
		if (resultWindow.length > 3) resultWindow = resultWindow.slice(-3)
		winTokens = safeCountTokens(resultWindow.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n"))
		total = winTokens + toolTokens
		if (total > TOTAL && resultWindow.length > 1) {
			resultWindow = resultWindow.slice(-1)
			winTokens = safeCountTokens(resultWindow.map((m) => `${m.role.toUpperCase()}: ${m.content}`).join("\n"))
			total = winTokens + toolTokens
		}
		if (total > TOTAL && hasOut) {
			// drop output, keep tool line only
			lines = [lines[0]]
		}
	}

	toolLines.length = 0
	toolLines.push(...lines)
	return resultWindow
}

async function persistArtifact(
	workspacePath: string,
	toolMeta: { name: string; params: any; resultText?: string },
): Promise<{ artifactPath: string; hash: string }> {
	const raw = toolMeta.resultText || ""
	const crypto = require("crypto")
	const hash = crypto.createHash("sha256").update(raw).digest("hex")
	const dir = require("path").join(workspacePath, ".roo-memory", "artifacts")
	await fs.mkdir(dir, { recursive: true })
	const base = `${hash}.txt`
	const metaBase = `${hash}.meta.json`
	const artifactPath = require("path").join(dir, base)
	await fs.writeFile(artifactPath, raw, "utf-8")
	const meta = {
		tool: { name: toolMeta.name, params: safeMinify(toolMeta.params) },
		created_at: new Date().toISOString(),
		hash,
		workspace_path: workspacePath,
	}
	await fs.writeFile(require("path").join(dir, metaBase), JSON.stringify(meta, null, 2), "utf-8")
	return { artifactPath, hash }
}

function buildArtifactDigest(toolMeta: { name: string; params: any; resultText?: string }): string {
	const name = toolMeta.name
	const raw = toolMeta.resultText || ""
	// Try JSON-aware summarization
	try {
		const parsed = JSON.parse(raw)
		if (Array.isArray(parsed)) {
			const count = parsed.length
			const keys = count > 0 && typeof parsed[0] === "object" ? Object.keys(parsed[0]).slice(0, 6) : []
			return `Tool ${name} returned ${count} items${keys.length ? ` with keys [${keys.join(", ")}]` : ""}`
		} else if (parsed && typeof parsed === "object") {
			const keys = Object.keys(parsed)
			// common shapes
			if (Array.isArray((parsed as any).rows)) {
				const rows = (parsed as any).rows
				const rowCount = Array.isArray(rows) ? rows.length : 0
				const rowKeys = rowCount > 0 && typeof rows[0] === "object" ? Object.keys(rows[0]).slice(0, 6) : []
				return `Tool ${name} returned rows=${rowCount}${rowKeys.length ? ` keys [${rowKeys.join(", ")}]` : ""}`
			}
			return `Tool ${name} returned object with keys [${keys.slice(0, 10).join(", ")}]`
		}
	} catch {}
	// Text fallback
	const preview = (raw || "").trim().split(/\r?\n/).slice(0, 5).join(" ")
	const short = preview.length > 180 ? preview.slice(0, 180) + "…" : preview
	return short ? `Tool ${name} output: ${short}` : ""
}

function extractFilePaths(toolMeta: { name: string; params: any }): string[] {
	const p: any = toolMeta.params || {}
	const out: string[] = []
	if (typeof p.path === "string") out.push(p.path)
	if (Array.isArray(p.paths)) {
		for (const x of p.paths) if (typeof x === "string") out.push(x)
	}
	// Deduplicate
	return Array.from(new Set(out))
}

async function computeFileHash(workspacePath: string, relPath: string): Promise<string> {
	const crypto = require("crypto")
	const path = require("path")
	const fs = require("fs/promises")
	const abs = path.isAbsolute(relPath) ? relPath : path.join(workspacePath, relPath)
	const buf = await fs.readFile(abs)
	return crypto.createHash("sha256").update(buf).digest("hex")
}

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
