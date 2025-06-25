import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle, SemanticType, ColorName } from "../../../theme/chatDefaults"
import type { ClassificationFactory, ParsedMessage } from "../types"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineSayTool } from "@roo/ExtensionMessage"

/**
 * Comprehensive classifier that handles ALL message types from the original system
 * This ensures we maintain full classification compatibility
 */
export class ComprehensiveClassifier implements ClassificationFactory {
	name = "ComprehensiveClassifier"
	priority = 5 // Lower priority - acts as fallback

	// Semantic classification rules - exactly from original system
	private TOOL_SEMANTIC_RULES = [
		{ priority: 11, pattern: /^(protected|lock)/i, semantic: "error" as const },
		{ priority: 10, pattern: /(fail|warning|problem)/i, semantic: "error" as const },
		{
			priority: 9,
			pattern:
				/(write_to_file|writeTo|writeFile|apply_diff|appliedDiff|applyDiff|insert_content|insertContent|search_and_replace|searchAndReplace|create.*file|edit|newFileCreated|editedExistingFile)/i,
			semantic: "file-write" as const,
		},
		{ priority: 8, pattern: /(command|execute|run|terminal)/i, semantic: "command" as const },
		{
			priority: 7,
			pattern: /(read_file|readFile|get_file|getFile|file.*content)/i,
			semantic: "file-read" as const,
		},
		{
			priority: 6,
			pattern:
				/(search_files|searchFiles|list_files|listFiles|listFilesTopLevel|listFilesRecursive|list.*file|search.*file)/i,
			semantic: "file-search" as const,
		},
		{
			priority: 5,
			pattern:
				/(codebase.*search|codebase_search|codebaseSearch|search.*code|find.*code|listCodeDefinitionNames|fetchInstructions)/i,
			semantic: "codebase-search" as const,
		},
		{ priority: 4, pattern: /(think|reason|analyz)/i, semantic: "thinking" as const },
		{
			priority: 3,
			pattern: /(mode|switch|task|new_task|newTask|switch_mode|switchMode)/i,
			semantic: "mode-change" as const,
		},
		{ priority: 2, pattern: /(complete|success|done|result|finish|finishTask)/i, semantic: "completion" as const },
		{ priority: 1, pattern: /(list|directory|folder|definitions)/i, semantic: "search" as const },
	] as const

	private SEMANTIC_COLOR_MAP: Record<SemanticType, ColorName> = {
		thinking: "yellow",
		error: "red",
		"file-read": "cyan",
		"file-write": "orange",
		"file-search": "teal",
		"codebase-search": "indigo",
		"mode-change": "purple",
		command: "gray",
		completion: "green",
		search: "pink",
		"user-input": "blue",
		"agent-response": "green",
		browser: "blue",
		mcp: "purple",
		api: "orange",
		subtask: "cyan",
		context: "gray",
		checkpoint: "green",
	}

	private MESSAGE_TYPE_DEFINITIONS = {
		USER_MESSAGES: new Set(["user_feedback", "user_feedback_diff"]),
		AGENT_CONVERSATION: new Set(["text"]),
		COMPONENT_OVERRIDES: new Set([
			"api_req_started",
			"completion_result",
			"condense_context",
			"condense_context_error",
		]),
		SYSTEM_STATUS: new Set(["api_req_finished", "shell_integration_warning", "checkpoint_saved"]),
	}

	canClassify(_parsed: ParsedMessage): boolean {
		// Handle everything as fallback
		return true
	}

	classify(_parsed: ParsedMessage): MessageStyle {
		const message = _parsed.raw
		const _metadata = _parsed.metadata

		// User messages
		if (this.isUserMessage(message)) {
			const semantic: SemanticType = "user-input"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "user",
			}
		}

		// Agent responses
		if (this.isAgentResponse(message)) {
			const semantic: SemanticType = "agent-response"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "agent",
			}
		}

		// Component overrides for special UI components
		if (this.isComponentOverride(message)) {
			if (message.say === "api_req_started" || message.say === "api_req_finished") {
				return { type: "component-override", component: "api-request" }
			}
			if (message.say === "completion_result") {
				return { type: "component-override", component: "task-completed" }
			}
			if (message.say === "condense_context" || message.say === "condense_context_error") {
				return { type: "component-override", component: "context-condense" }
			}
		}

		// Special semantic override for subtask results
		if (message.say === "subtask_result") {
			const semantic: SemanticType = "mode-change"
			return {
				type: "semantic-override",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Handle reasoning messages directly
		if (message.type === "say" && message.say === "reasoning") {
			const semantic: SemanticType = "thinking"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Handle SPECIFIC error message types only
		if (message.type === "say" && message.say?.includes("error") && message.say !== "error") {
			const semantic: SemanticType = "error"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Protected files get highest priority
		if (this.isProtectedFileOperation(message)) {
			const semantic: SemanticType = "error"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Handle ask-type operations
		if (message.type === "ask") {
			return this.classifyAskMessage(message)
		}

		// Handle say-type tool operations
		if (message.type === "say") {
			return this.classifySayMessage(message)
		}

		// Handle system status messages
		if (message.type === "say" && this.MESSAGE_TYPE_DEFINITIONS.SYSTEM_STATUS.has(message.say || "")) {
			const semantic: SemanticType = "search"
			return {
				type: "standard",
				pattern: "status-bar",
				semantic,
				color: this.getColorFromSemantic(semantic),
			}
		}

		// Default fallback
		const fallbackSemantic: SemanticType = "search"
		return {
			type: "standard",
			pattern: "bubble",
			semantic: fallbackSemantic,
			color: this.getColorFromSemantic(fallbackSemantic),
			variant: "work",
		}
	}

	private classifyAskMessage(message: ClineMessage): MessageStyle {
		switch (message.ask) {
			case "followup": {
				const semantic: SemanticType = "completion"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "command":
			case "command_output": {
				const semantic: SemanticType = "command"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "use_mcp_server": {
				const semantic: SemanticType = "mcp"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "tool": {
				// Quick check: must look like JSON before attempting to parse
				const text = message.text?.trim()
				if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
					const fallbackSemantic: SemanticType = "search"
					return {
						type: "standard",
						pattern: "bubble",
						semantic: fallbackSemantic,
						color: this.getColorFromSemantic(fallbackSemantic),
						variant: "work",
					}
				}

				const rawTool = safeJsonParse<any>(message.text)

				if (rawTool && rawTool.question) {
					const semantic: SemanticType = "completion"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: this.getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				if (rawTool && rawTool.tool) {
					const semantic = this.getToolSemantic(rawTool.tool)
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: this.getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				const fallbackSemantic: SemanticType = "search"
				return {
					type: "standard",
					pattern: "bubble",
					semantic: fallbackSemantic,
					color: this.getColorFromSemantic(fallbackSemantic),
					variant: "work",
				}
			}

			case "completion_result":
				return { type: "component-override", component: "task-completed" }

			case "api_req_failed":
			case "mistake_limit_reached":
			case "auto_approval_max_req_reached": {
				const semantic: SemanticType = "error"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "browser_action_launch": {
				const semantic: SemanticType = "browser"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "resume_task":
			case "resume_completed_task": {
				const semantic: SemanticType = "subtask"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			default: {
				const semantic: SemanticType = "search"
				return {
					type: "standard",
					pattern: "status-bar",
					semantic,
					color: this.getColorFromSemantic(semantic),
				}
			}
		}
	}

	private classifySayMessage(message: ClineMessage): MessageStyle {
		// Handle specific say types first
		switch (message.say) {
			case "browser_action":
			case "browser_action_result": {
				const semantic: SemanticType = "browser"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "mcp_server_request_started":
			case "mcp_server_response": {
				const semantic: SemanticType = "mcp"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "api_req_started":
			case "api_req_finished":
			case "api_req_retried":
			case "api_req_retry_delayed":
			case "api_req_deleted": {
				const semantic: SemanticType = "api"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "condense_context":
			case "condense_context_error": {
				const semantic: SemanticType = "context"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "checkpoint_saved": {
				const semantic: SemanticType = "checkpoint"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			case "codebase_search_result": {
				const semantic: SemanticType = "codebase-search"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: this.getColorFromSemantic(semantic),
					variant: "work",
				}
			}
		}

		// Quick check: must look like JSON before attempting to parse
		const text = message.text?.trim()
		if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
			// Default for say messages
			const semantic: SemanticType = "search"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		const toolData = safeJsonParse<any>(message.text)

		if (toolData && toolData.question) {
			const semantic: SemanticType = "completion"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		if (this.validateTool(toolData)) {
			const semantic = this.getToolSemantic(toolData.tool)
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: this.getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Default for say messages
		const semantic: SemanticType = "search"
		return {
			type: "standard",
			pattern: "bubble",
			semantic,
			color: this.getColorFromSemantic(semantic),
			variant: "work",
		}
	}

	private isUserMessage(message: ClineMessage): boolean {
		return message.type === "say" && this.MESSAGE_TYPE_DEFINITIONS.USER_MESSAGES.has(message.say || "")
	}

	private isAgentResponse(message: ClineMessage): boolean {
		return message.type === "say" && this.MESSAGE_TYPE_DEFINITIONS.AGENT_CONVERSATION.has(message.say || "")
	}

	private isComponentOverride(message: ClineMessage): boolean {
		return message.type === "say" && this.MESSAGE_TYPE_DEFINITIONS.COMPONENT_OVERRIDES.has(message.say || "")
	}

	private isProtectedFileOperation(message: ClineMessage): boolean {
		if (message.type === "ask" && message.ask === "tool") {
			// Quick check: must look like JSON before attempting to parse
			const text = message.text?.trim()
			if (!text || (!text.startsWith("{") && !text.startsWith("["))) {
				return false
			}
			const tool = safeJsonParse<ClineSayTool>(message.text)
			if (this.validateTool(tool)) {
				if ((tool as any).isProtected === true) {
					return true
				}

				const path = (tool as any).path || ""
				if (path) {
					const protectedPatterns = [
						/^\.rooignore$/,
						/^\.roomodes$/,
						/^\.roorules/,
						/^\.clinerules/,
						/^\.roo\//,
						/\/\.roo\//,
						/^\.rooprotected$/,
					]
					return protectedPatterns.some((pattern) => pattern.test(path))
				}
			}
		}
		return false
	}

	private validateTool(tool: any): tool is ClineSayTool {
		return tool && typeof tool === "object" && typeof tool.tool === "string"
	}

	private getToolSemantic(toolName: string): SemanticType {
		const sortedRules = this.TOOL_SEMANTIC_RULES.slice().sort((a, b) => b.priority - a.priority)
		const matchedRule = sortedRules.find((rule) => rule.pattern.test(toolName))
		return matchedRule?.semantic || "search"
	}

	private getColorFromSemantic(semantic: SemanticType): ColorName {
		return this.SEMANTIC_COLOR_MAP[semantic]
	}
}
