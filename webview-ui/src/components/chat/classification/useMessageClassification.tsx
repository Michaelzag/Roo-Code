import { useCallback } from "react"
import type { ClineMessage } from "@roo-code/types"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineSayTool } from "@roo/ExtensionMessage"
import type { MessageStyle, SemanticType, ColorName } from "../theme/chatDefaults"

// Semantic classification rules - Maps tools to semantic meaning
const TOOL_SEMANTIC_RULES = [
	// Error/Security operations
	{ priority: 11, pattern: /^(protected|lock)/i, semantic: "error" as const },
	{ priority: 10, pattern: /(fail|warning|problem)/i, semantic: "error" as const },
	// NOTE: Generic "error" pattern removed from TOOL_SEMANTIC_RULES to allow selective error handling
	// Specific error types (diff_error, rooignore_error, etc.) are handled explicitly in classifyMessage

	// File write operations (ALL variants - camelCase and snake_case)
	{
		priority: 9,
		pattern:
			/(write_to_file|writeTo|writeFile|apply_diff|appliedDiff|applyDiff|insert_content|insertContent|search_and_replace|searchAndReplace|create.*file|edit|newFileCreated|editedExistingFile)/i,
		semantic: "file-write" as const,
	},
	{ priority: 8, pattern: /(command|execute|run|terminal)/i, semantic: "command" as const },

	// File read operations (ALL variants - camelCase and snake_case)
	{ priority: 7, pattern: /(read_file|readFile|get_file|getFile|file.*content)/i, semantic: "file-read" as const },

	// File search operations (ALL variants including list operations)
	{
		priority: 6,
		pattern:
			/(search_files|searchFiles|list_files|listFiles|listFilesTopLevel|listFilesRecursive|list.*file|search.*file)/i,
		semantic: "file-search" as const,
	},

	// Codebase search (ALL variants)
	{
		priority: 5,
		pattern: /(codebase.*search|codebaseSearch|search.*code|find.*code|listCodeDefinitionNames|fetchInstructions)/i,
		semantic: "codebase-search" as const,
	},

	// System thinking/reasoning
	{ priority: 4, pattern: /(think|reason|analyz)/i, semantic: "thinking" as const },

	// Mode changes/special operations (ALL variants)
	{
		priority: 3,
		pattern: /(mode|switch|task|new_task|newTask|switch_mode|switchMode)/i,
		semantic: "mode-change" as const,
	},

	// Success/completion (ALL variants)
	{ priority: 2, pattern: /(complete|success|done|result|finish|finishTask)/i, semantic: "completion" as const },

	// General search operations (fallback)
	{ priority: 1, pattern: /(list|directory|folder|definitions)/i, semantic: "search" as const },
] as const

// Semantic type to color mapping - enforced by bubble components
const SEMANTIC_COLOR_MAP: Record<SemanticType, ColorName> = {
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
} as const

// Simple message type definitions for component overrides only
const MESSAGE_TYPE_DEFINITIONS = {
	// User input messages
	USER_MESSAGES: new Set(["user_feedback", "user_feedback_diff"]),

	// Agent conversation messages
	AGENT_CONVERSATION: new Set(["text"]),

	// Component overrides (require special components)
	COMPONENT_OVERRIDES: new Set([
		"api_req_started",
		"completion_result",
		"condense_context",
		"condense_context_error",
	]),

	// System status messages
	SYSTEM_STATUS: new Set([
		"api_req_finished",
		"shell_integration_warning",
		"checkpoint_saved",
		"codebase_search_result",
	]),
} as const

// Validation helper for parsed tool data
const validateTool = (tool: any): tool is ClineSayTool => {
	return tool && typeof tool === "object" && typeof tool.tool === "string"
}

// Get semantic type for tool based on priority rules - SINGLE SOURCE OF TRUTH
const getToolSemantic = (toolName: string): SemanticType => {
	// Sort by priority (highest first) and find first match
	const sortedRules = TOOL_SEMANTIC_RULES.slice().sort((a, b) => b.priority - a.priority)
	const matchedRule = sortedRules.find((rule) => rule.pattern.test(toolName))
	return matchedRule?.semantic || "search" // Default fallback
}

// Get color from semantic type - ensures consistency
const getColorFromSemantic = (semantic: SemanticType): ColorName => {
	return SEMANTIC_COLOR_MAP[semantic]
}

// Simple helper functions for basic message types only
const isUserMessage = (message: ClineMessage): boolean => {
	return message.type === "say" && MESSAGE_TYPE_DEFINITIONS.USER_MESSAGES.has(message.say || "")
}

const isAgentResponse = (message: ClineMessage): boolean => {
	return message.type === "say" && MESSAGE_TYPE_DEFINITIONS.AGENT_CONVERSATION.has(message.say || "")
}

const isComponentOverride = (message: ClineMessage): boolean => {
	return message.type === "say" && MESSAGE_TYPE_DEFINITIONS.COMPONENT_OVERRIDES.has(message.say || "")
}

const isProtectedFileOperation = (message: ClineMessage): boolean => {
	if (message.type === "ask" && message.ask === "tool") {
		const tool = safeJsonParse<ClineSayTool>(message.text)
		if (validateTool(tool)) {
			// Check backend-provided isProtected flag first
			if ((tool as any).isProtected === true) {
				return true
			}

			// Fallback: check path patterns for Roo protected files
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

export const useMessageClassification = () => {
	const classifyMessage = useCallback((message: ClineMessage): MessageStyle => {
		// User messages
		if (isUserMessage(message)) {
			const semantic: SemanticType = "user-input"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: getColorFromSemantic(semantic),
				variant: "user",
			}
		}

		// Agent responses
		if (isAgentResponse(message)) {
			const semantic: SemanticType = "agent-response"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: getColorFromSemantic(semantic),
				variant: "agent",
			}
		}

		// Component overrides for special UI components
		if (isComponentOverride(message)) {
			// Map specific overrides to components
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
				color: getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Handle reasoning messages directly (bypass tool classification)
		if (message.type === "say" && message.say === "reasoning") {
			const semantic: SemanticType = "thinking"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Handle SPECIFIC error message types only - suppress generic "error" messages
		//
		// RATIONALE: The backend tools often send DUPLICATE error messages for the same event:
		// 1. A generic "error" message with basic information
		// 2. A specific error message (e.g., "diff_error", "rooignore_error") with detailed context
		//
		// This creates duplicate error bubbles showing the same failure twice, which is poor UX.
		// Since we cannot modify the backend to fix the duplication, we implement a frontend solution:
		// - RENDER specific error types (diff_error, rooignore_error, etc.) - they have actionable details
		// - SUPPRESS generic "error" messages - they are usually redundant when specific errors exist
		//
		// This maintains backward compatibility while eliminating duplicate error displays.
		// Future specific error types will automatically work without code changes.
		if (message.type === "say" && message.say?.includes("error") && message.say !== "error") {
			const semantic: SemanticType = "error"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// NOTE: Generic "error" messages are intentionally NOT classified here.
		// They fall through to the default fallback, which uses status-bar pattern (minimal display).
		// This prevents duplicate error bubbles while maintaining system stability.

		// Protected files get highest priority - check before tool classification
		if (isProtectedFileOperation(message)) {
			const semantic: SemanticType = "error"
			return {
				type: "standard",
				pattern: "bubble",
				semantic,
				color: getColorFromSemantic(semantic),
				variant: "work",
			}
		}

		// Handle ask-type operations with unified rule-based classification
		if (message.type === "ask") {
			switch (message.ask) {
				case "followup": {
					const semantic: SemanticType = "completion"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "command": {
					const semantic: SemanticType = "command"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "command_output": {
					const semantic: SemanticType = "command"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "use_mcp_server": {
					const semantic: SemanticType = "mcp"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "tool": {
					const rawTool = safeJsonParse<any>(message.text)

					// Handle question-type operations (ask_followup_question tool)
					if (rawTool && rawTool.question) {
						const semantic: SemanticType = "completion"
						return {
							type: "standard",
							pattern: "bubble",
							semantic,
							color: getColorFromSemantic(semantic),
							variant: "work",
						}
					}

					// Handle ANY tool - even if not in the validated list
					if (rawTool && rawTool.tool) {
						// Use unified rule-based semantic classification for ANY tool name
						const semantic = getToolSemantic(rawTool.tool)
						return {
							type: "standard",
							pattern: "bubble",
							semantic,
							color: getColorFromSemantic(semantic),
							variant: "work",
						}
					}

					// Better fallback - don't use status-bar for unknown tools
					const fallbackSemantic: SemanticType = "search"
					return {
						type: "standard",
						pattern: "bubble",
						semantic: fallbackSemantic,
						color: getColorFromSemantic(fallbackSemantic),
						variant: "work",
					}
				}

				case "completion_result":
					return { type: "component-override", component: "task-completed" }

				case "api_req_failed": {
					const semantic: SemanticType = "error"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "mistake_limit_reached": {
					const semantic: SemanticType = "error"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "browser_action_launch": {
					const semantic: SemanticType = "browser"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
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
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "auto_approval_max_req_reached": {
					const semantic: SemanticType = "error"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				default: {
					const semantic: SemanticType = "search"
					return {
						type: "standard",
						pattern: "status-bar",
						semantic,
						color: getColorFromSemantic(semantic),
					}
				}
			}
		}

		// Handle say-type tool operations (ClineSayTool messages)
		if (message.type === "say") {
			// Handle specific say types first
			switch (message.say) {
				case "browser_action":
				case "browser_action_result": {
					const semantic: SemanticType = "browser"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
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
						color: getColorFromSemantic(semantic),
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
						color: getColorFromSemantic(semantic),
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
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}

				case "checkpoint_saved": {
					const semantic: SemanticType = "checkpoint"
					return {
						type: "standard",
						pattern: "bubble",
						semantic,
						color: getColorFromSemantic(semantic),
						variant: "work",
					}
				}
			}

			const toolData = safeJsonParse<any>(message.text)

			// Handle question-type operations (ask_followup_question tool)
			if (toolData && toolData.question) {
				const semantic: SemanticType = "completion"
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: getColorFromSemantic(semantic),
					variant: "work",
				}
			}

			// Handle regular tool operations
			if (validateTool(toolData)) {
				// Use unified rule-based semantic classification for say-type tool messages
				const semantic = getToolSemantic(toolData.tool)
				return {
					type: "standard",
					pattern: "bubble",
					semantic,
					color: getColorFromSemantic(semantic),
					variant: "work",
				}
			}
		}

		// Handle system status messages
		if (message.type === "say" && MESSAGE_TYPE_DEFINITIONS.SYSTEM_STATUS.has(message.say || "")) {
			const semantic: SemanticType = "search"
			return {
				type: "standard",
				pattern: "status-bar",
				semantic,
				color: getColorFromSemantic(semantic),
			}
		}

		// Default fallback - use bubble instead of status-bar to avoid raw JSON display
		const fallbackSemantic: SemanticType = "search"
		return {
			type: "standard",
			pattern: "bubble",
			semantic: fallbackSemantic,
			color: getColorFromSemantic(fallbackSemantic),
			variant: "work",
		}
	}, [])

	return { classifyMessage }
}
