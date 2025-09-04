import type { ApiHandler } from "../../api"
import type { ToolName } from "@roo-code/types"
import type { Task } from "../../core/task/Task"
import type { Message as MemoryMessage } from "./types"
import { ConversationMemoryManager } from "./manager"

/**
 * Manages turn-based processing for conversation memory.
 * Replaces the problematic per-tool-call processing with proper turn completion detection.
 */
export class ConversationMemoryTurnProcessor {
	private static instance: ConversationMemoryTurnProcessor | undefined

	// Tools that require special handling
	private static readonly SUB_TASK_TOOLS: Set<string> = new Set(["new_task", "switch_mode"])
	private static readonly MCP_TOOLS: Set<string> = new Set(["use_mcp_tool", "access_mcp_resource"])
	private static readonly FILE_TOOLS: Set<string> = new Set([
		"write_to_file",
		"apply_diff",
		"insert_content",
		"search_and_replace",
		"read_file",
	])

	// Configuration for chunked processing
	private static readonly MAX_TOOLS_PER_CHUNK = 15 // Process every 15 tools to prevent information loss
	private static readonly MAX_TOOLS_PER_TURN = 50 // Force turn completion after 50 tools
	private static readonly CHUNK_PROCESSING_DELAY = 2000 // 2 second delay between chunks

	private turnBuffers = new Map<string, TurnBuffer>()

	static getInstance(): ConversationMemoryTurnProcessor {
		if (!this.instance) {
			this.instance = new ConversationMemoryTurnProcessor()
		}
		return this.instance
	}

	/**
	 * Called when assistant streaming starts - initializes turn buffer
	 */
	public onAssistantStreamStart(cline: Task): void {
		const workspaceId = this.getWorkspaceId(cline)
		if (!workspaceId) return

		// Initialize or reset turn buffer for this workspace
		this.turnBuffers.set(workspaceId, {
			workspaceId,
			userMessage: this.extractCurrentUserMessage(cline),
			toolCalls: [],
			assistantResponse: "",
			startTime: new Date(),
			hasSubTaskTool: false,
			hasMcpTool: false,
			hasFileTool: false,
			isComplete: false,
		})
	}

	/**
	 * Called when a tool is being processed - adds to turn buffer
	 */
	public onToolProcessing(cline: Task, toolName: ToolName, toolParams: any, toolResult?: string): void {
		const workspaceId = this.getWorkspaceId(cline)
		if (!workspaceId) return
		const buffer = this.turnBuffers.get(workspaceId)
		if (!buffer) return

		// Add tool call to buffer
		buffer.toolCalls.push({
			name: toolName,
			params: toolParams,
			result: toolResult || "",
			timestamp: new Date(),
		})

		// Mark special tool types
		const toolStr = String(toolName)
		if (ConversationMemoryTurnProcessor.SUB_TASK_TOOLS.has(toolStr)) {
			buffer.hasSubTaskTool = true
		} else if (ConversationMemoryTurnProcessor.MCP_TOOLS.has(toolStr)) {
			buffer.hasMcpTool = true
		} else if (ConversationMemoryTurnProcessor.FILE_TOOLS.has(toolStr)) {
			buffer.hasFileTool = true
		}

		// Store last tool for memory processing
		;(cline as any).memoryLastTool = {
			name: toolName,
			params: toolParams,
			resultText: toolResult,
		}

		// CHUNKED PROCESSING: Handle long tool chains to prevent information loss
		const shouldProcessChunk = this.shouldProcessToolChunk(buffer)
		const shouldForceComplete = this.shouldForceCompleteBufferFromToolCount(buffer)

		if (shouldForceComplete) {
			// Force complete the turn due to excessive tool usage
			console.warn(
				`[TurnProcessor] Forcing turn completion after ${buffer.toolCalls.length} tools to prevent memory overload`,
			)
			this.onAssistantStreamComplete(cline).catch((error) => {
				console.error("[TurnProcessor] Forced turn completion failed:", error)
			})
		} else if (shouldProcessChunk) {
			// Process current chunk to preserve context in long tool sequences
			this.processToolChunk(cline, buffer).catch((error) => {
				console.error("[TurnProcessor] Tool chunk processing failed:", error)
			})
		}
	}

	/**
	 * Called when assistant response content is being added
	 */
	public onAssistantContent(cline: Task, content: string): void {
		const workspaceId = this.getWorkspaceId(cline)
		if (!workspaceId) return
		const buffer = this.turnBuffers.get(workspaceId)
		if (!buffer) return

		buffer.assistantResponse += content
	}

	/**
	 * Called when assistant streaming completes - triggers turn processing
	 */
	public async onAssistantStreamComplete(cline: Task): Promise<void> {
		const workspaceId = this.getWorkspaceId(cline)
		if (!workspaceId) return
		const buffer = this.turnBuffers.get(workspaceId)
		if (!buffer || buffer.isComplete) return

		buffer.isComplete = true
		buffer.endTime = new Date()

		try {
			await this.processTurn(cline, buffer)
		} catch (error) {
			console.error("[ConversationMemoryTurnProcessor] Turn processing failed:", error)
		} finally {
			// Clean up buffer
			this.turnBuffers.delete(workspaceId)
		}
	}

	/**
	 * Process a complete conversation turn based on tool types and requirements
	 */
	private async processTurn(cline: Task, buffer: TurnBuffer): Promise<void> {
		const provider = cline.providerRef.deref()
		const context = provider?.context
		const cwd = cline.cwd && cline.cwd.trim() !== "" ? cline.cwd : undefined

		if (!context) return

		const manager = ConversationMemoryManager.getInstance(context, cwd)
		if (!manager || !manager.isFeatureEnabled || !manager.isInitialized) return

		// Build context messages (current + last 4 pairs)
		const contextMessages = this.buildContextMessages(cline, buffer)
		if (contextMessages.length < 2) return // Need at least user + assistant

		const modelId = cline.api?.getModel?.().id
		const toolMeta = (cline as any).memoryLastTool

		// Determine processing strategy based on tool types
		if (buffer.hasSubTaskTool) {
			// SUB-TASK: Block and process immediately to seed sub-task memory
			await this.processSubTaskTurn(manager, contextMessages, cline.api, modelId, toolMeta, provider)
		} else if (buffer.hasMcpTool) {
			// MCP TOOLS: Priority processing but non-blocking
			await this.processMcpTurn(manager, contextMessages, cline.api, modelId, toolMeta, provider)
		} else if (buffer.hasFileTool) {
			// FILE TOOLS: Coordinate with codebase indexing
			await this.processFileTurn(manager, contextMessages, cline.api, modelId, toolMeta, provider)
		} else {
			// NORMAL TOOLS: Standard non-blocking processing
			await this.processNormalTurn(manager, contextMessages, cline.api, modelId, toolMeta, provider)
		}
	}

	/**
	 * Build context messages: current turn + last 4 user/assistant pairs
	 */
	private buildContextMessages(cline: Task, buffer: TurnBuffer): MemoryMessage[] {
		const messages: MemoryMessage[] = []

		// Get conversation history
		const history = cline.apiConversationHistory || []

		// Find user/assistant pairs (excluding current incomplete turn)
		const pairs: MemoryMessage[][] = []
		let currentPair: MemoryMessage[] = []

		// Process history backwards to find last complete pairs
		for (let i = history.length - 2; i >= 0; i--) {
			// Skip -1 (current incomplete assistant response)
			const msg = history[i]
			if (!msg || typeof msg.role !== "string") continue

			const content = this.extractContent(msg.content)
			if (!content.trim()) continue

			const memoryMsg: MemoryMessage = {
				role: msg.role as "user" | "assistant",
				content,
				timestamp: new Date().toISOString(),
			}

			if (msg.role === "assistant") {
				currentPair.unshift(memoryMsg) // Add assistant at front
				if (currentPair.length === 2) {
					pairs.unshift(currentPair) // Add complete pair at front
					currentPair = []
					if (pairs.length >= 4) break // Have 4 complete pairs
				}
			} else if (msg.role === "user") {
				currentPair = [memoryMsg] // Start new pair with user message
			}
		}

		// Add last 4 (or fewer if available) complete pairs
		for (const pair of pairs.slice(0, 4)) {
			messages.push(...pair)
		}

		// Add current turn
		if (buffer.userMessage) {
			messages.push(buffer.userMessage)
		}

		// Add current assistant response
		const assistantContent = buffer.assistantResponse || ""
		const toolSummary = this.buildToolSummary(buffer.toolCalls)
		const fullAssistantContent = toolSummary
			? `${assistantContent}\n\nTools used: ${toolSummary}`
			: assistantContent

		if (fullAssistantContent.trim()) {
			messages.push({
				role: "assistant",
				content: fullAssistantContent,
				timestamp: (buffer.endTime || new Date()).toISOString(),
			})
		}

		return messages
	}

	/**
	 * Process turn with sub-task tool (BLOCKING)
	 */
	private async processSubTaskTurn(
		manager: ConversationMemoryManager,
		messages: MemoryMessage[],
		api: ApiHandler,
		modelId: string | undefined,
		toolMeta: any,
		provider: any,
	): Promise<void> {
		// Notify UI: blocking processing started
		this.notifyUI(provider, "extract", "started", "Processing turn before sub-task (blocking)")

		try {
			// BLOCKING: Wait for memory processing to complete
			await manager.ingestTurn(messages as any, api as any, modelId, toolMeta as any)
			this.notifyUI(provider, "extract", "completed", "Turn processed, sub-task memory ready")
		} catch (error) {
			console.error("[ConversationMemoryTurnProcessor] Sub-task turn processing failed:", error)
			this.notifyUI(provider, "extract", "failed", `Processing failed: ${error}`)
			throw error // Re-throw for sub-task to handle
		}
	}

	/**
	 * Process turn with MCP tools (priority, non-blocking)
	 */
	private async processMcpTurn(
		manager: ConversationMemoryManager,
		messages: MemoryMessage[],
		api: ApiHandler,
		modelId: string | undefined,
		toolMeta: any,
		provider: any,
	): Promise<void> {
		this.notifyUI(provider, "extract", "started", "Priority processing MCP tool turn")

		// Non-blocking but prioritized
		manager
			.ingestTurn(messages as any, api as any, modelId, toolMeta as any)
			.then(() => {
				this.notifyUI(provider, "extract", "completed", "MCP turn processed")
			})
			.catch((error) => {
				console.error("[ConversationMemoryTurnProcessor] MCP turn processing failed:", error)
				this.notifyUI(provider, "extract", "failed", `MCP processing failed: ${error}`)
			})
	}

	/**
	 * Process turn with file tools (coordinate with codebase indexing)
	 */
	private async processFileTurn(
		manager: ConversationMemoryManager,
		messages: MemoryMessage[],
		api: ApiHandler,
		modelId: string | undefined,
		toolMeta: any,
		provider: any,
	): Promise<void> {
		this.notifyUI(provider, "extract", "started", "Processing file tool turn (waiting for codebase sync)")

		// TODO: Wait for codebase indexing to complete
		// For now, add a small delay to allow file operations to settle
		return new Promise((resolve, reject) => {
			setTimeout(async () => {
				try {
					await manager.ingestTurn(messages as any, api as any, modelId, toolMeta as any)
					this.notifyUI(provider, "extract", "completed", "File tool turn processed")
					resolve()
				} catch (error) {
					console.error("[ConversationMemoryTurnProcessor] File turn processing failed:", error)
					this.notifyUI(provider, "extract", "failed", `File processing failed: ${error}`)
					reject(error)
				}
			}, 1000) // 1 second delay for file operations
		})
	}

	/**
	 * Process normal turn (non-blocking)
	 */
	private async processNormalTurn(
		manager: ConversationMemoryManager,
		messages: MemoryMessage[],
		api: ApiHandler,
		modelId: string | undefined,
		toolMeta: any,
		provider: any,
	): Promise<void> {
		this.notifyUI(provider, "extract", "started", "Processing conversation turn")

		// Non-blocking background processing
		manager
			.ingestTurn(messages as any, api as any, modelId, toolMeta as any)
			.then(() => {
				this.notifyUI(provider, "extract", "completed", "Turn processed")
			})
			.catch((error) => {
				console.error("[ConversationMemoryTurnProcessor] Normal turn processing failed:", error)
				this.notifyUI(provider, "extract", "failed", `Processing failed: ${error}`)
			})
	}

	/**
	 * Extract current user message from conversation history
	 */
	private extractCurrentUserMessage(cline: Task): MemoryMessage | undefined {
		const history = cline.apiConversationHistory || []

		// Find the most recent user message
		for (let i = history.length - 1; i >= 0; i--) {
			const msg = history[i]
			if (msg && msg.role === "user") {
				const content = this.extractContent(msg.content)
				if (content.trim()) {
					return {
						role: "user",
						content,
						timestamp: new Date().toISOString(),
					}
				}
			}
		}
		return undefined
	}

	/**
	 * Extract content from various message formats
	 */
	private extractContent(content: any): string {
		if (typeof content === "string") return content
		if (Array.isArray(content)) {
			return content
				.map((block: any) => (typeof block === "string" ? block : block?.text || ""))
				.filter((text: string) => text)
				.join("\n")
		}
		try {
			return JSON.stringify(content)
		} catch {
			return String(content)
		}
	}

	/**
	 * Build a summary of tools used in this turn
	 */
	private buildToolSummary(toolCalls: ToolCall[]): string {
		if (toolCalls.length === 0) return ""

		const toolNames = toolCalls.map((call) => call.name).join(", ")
		return `${toolNames} (${toolCalls.length} tools)`
	}

	/**
	 * Get workspace identifier for this task
	 */
	private getWorkspaceId(cline: Task): string | undefined {
		return cline.cwd && cline.cwd.trim() !== "" ? cline.cwd : undefined
	}

	/**
	 * Determine if we should process a chunk of tools to prevent information loss
	 */
	private shouldProcessToolChunk(buffer: TurnBuffer): boolean {
		// Process chunks every MAX_TOOLS_PER_CHUNK tools, but not if we already have sub-tasks
		// (sub-tasks will handle their own processing)
		if (buffer.hasSubTaskTool) return false

		return (
			buffer.toolCalls.length > 0 &&
			buffer.toolCalls.length % ConversationMemoryTurnProcessor.MAX_TOOLS_PER_CHUNK === 0
		)
	}

	/**
	 * Determine if we should force completion due to excessive tool usage
	 */
	private shouldForceCompleteBufferFromToolCount(buffer: TurnBuffer): boolean {
		return buffer.toolCalls.length >= ConversationMemoryTurnProcessor.MAX_TOOLS_PER_TURN
	}

	/**
	 * Process a chunk of tools to preserve context in long tool sequences
	 */
	private async processToolChunk(cline: Task, buffer: TurnBuffer): Promise<void> {
		const provider = cline.providerRef.deref()
		const context = provider?.context
		const cwd = cline.cwd && cline.cwd.trim() !== "" ? cline.cwd : undefined

		if (!context) return

		const manager = ConversationMemoryManager.getInstance(context, cwd)
		if (!manager || !manager.isFeatureEnabled || !manager.isInitialized) return

		// Build context for current chunk - use current conversation state
		const chunkMessages = this.buildChunkContextMessages(cline, buffer)
		if (chunkMessages.length < 2) return // Need at least user + partial assistant

		const modelId = cline.api?.getModel?.().id
		const toolMeta = (cline as any).memoryLastTool

		this.notifyUI(provider, "extract", "started", `Processing tool chunk (${buffer.toolCalls.length} tools so far)`)

		try {
			// Create a chunk-specific summary prompt to preserve important details
			const chunkSummary = this.buildToolChunkSummary(buffer)
			const enhancedMessages = [...chunkMessages]

			// Add chunk summary to the assistant message
			if (enhancedMessages.length > 0) {
				const lastMsg = enhancedMessages[enhancedMessages.length - 1]
				if (lastMsg.role === "assistant") {
					lastMsg.content += `\n\nTool sequence summary: ${chunkSummary}`
				}
			}

			// Non-blocking chunk processing
			manager
				.ingestTurn(enhancedMessages as any, cline.api as any, modelId, toolMeta as any)
				.then(() => {
					this.notifyUI(
						provider,
						"extract",
						"completed",
						`Tool chunk processed (${buffer.toolCalls.length} tools)`,
					)
				})
				.catch((error: any) => {
					console.error("[TurnProcessor] Tool chunk processing failed:", error)
					this.notifyUI(provider, "extract", "failed", `Tool chunk processing failed: ${error}`)
				})

			// Mark that we've processed this chunk
			buffer.lastChunkProcessedAt = buffer.toolCalls.length
		} catch (error) {
			console.error("[TurnProcessor] Tool chunk processing setup failed:", error)
			this.notifyUI(provider, "extract", "failed", `Tool chunk setup failed: ${error}`)
		}
	}

	/**
	 * Build context messages for chunk processing
	 */
	private buildChunkContextMessages(cline: Task, buffer: TurnBuffer): MemoryMessage[] {
		const messages: MemoryMessage[] = []

		// Add user message if available
		if (buffer.userMessage) {
			messages.push(buffer.userMessage)
		}

		// Add current assistant progress with tool summary
		const toolSummary = this.buildToolChunkSummary(buffer)
		const assistantContent = buffer.assistantResponse
			? `${buffer.assistantResponse}\n\nTools used so far: ${toolSummary}`
			: `Tools used so far: ${toolSummary}`

		if (assistantContent.trim()) {
			messages.push({
				role: "assistant",
				content: assistantContent,
				timestamp: new Date().toISOString(),
			})
		}

		return messages
	}

	/**
	 * Build a detailed summary of tools used in current chunk
	 */
	private buildToolChunkSummary(buffer: TurnBuffer): string {
		const recentTools = buffer.toolCalls.slice(-ConversationMemoryTurnProcessor.MAX_TOOLS_PER_CHUNK)

		const summaryParts = recentTools.map((tool, index) => {
			const toolResult = tool.result.length > 200 ? `${tool.result.substring(0, 200)}...` : tool.result
			return `${index + 1}. ${tool.name}: ${toolResult}`
		})

		return `Recent ${recentTools.length} tools:\n${summaryParts.join("\n")}`
	}

	/**
	 * Send UI notifications
	 */
	private notifyUI(provider: any, operation: string, status: string, message: string): void {
		try {
			provider?.postMessageToWebview?.({
				type: "conversationMemoryOperation",
				payload: { operation, status, message },
			})
		} catch {
			// Ignore UI notification failures
		}
	}
}

/**
 * Turn buffer interface
 */
interface TurnBuffer {
	workspaceId: string
	userMessage?: MemoryMessage
	toolCalls: ToolCall[]
	assistantResponse: string
	startTime: Date
	endTime?: Date
	hasSubTaskTool: boolean
	hasMcpTool: boolean
	hasFileTool: boolean
	isComplete: boolean
	lastChunkProcessedAt?: number // Track last tool count when chunk was processed
}

/**
 * Tool call interface
 */
interface ToolCall {
	name: ToolName | string
	params: any
	result: string
	timestamp: Date
}
