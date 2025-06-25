import type { ClineMessage } from "@roo-code/types"
import type { MessageParserFactory, ParsedMessage } from "../types"

/**
 * Comprehensive parser that handles ALL message types from the original system
 * This ensures we don't lose any classification capabilities
 */
export class ComprehensiveParser implements MessageParserFactory {
	name = "ComprehensiveParser"
	priority = 10 // Lower priority - acts as fallback for unhandled messages

	canParse(_message: ClineMessage): boolean {
		// Parse everything that other parsers don't handle
		return true
	}

	parse(message: ClineMessage): ParsedMessage {
		// Determine the parsed message type based on original classification logic
		const messageType = this.determineMessageType(message)

		return {
			raw: message,
			type: messageType,
			text: message.text,
			isPartial: message.partial,
			timestamp: message.ts,
			// Include all original message data for classification
			metadata: {
				originalType: message.type,
				originalAsk: message.ask,
				originalSay: (message as any).say,
				parsedJson: this.tryParseJson(message.text),
			},
		}
	}

	private determineMessageType(message: ClineMessage): ParsedMessage["type"] {
		// Ask message types
		if (message.type === "ask") {
			switch (message.ask) {
				case "followup":
				case "completion_result":
					return "completion"
				case "command":
				case "command_output":
					return "command"
				case "use_mcp_server":
					return "mcp-operation"
				case "browser_action_launch":
					return "browser-action"
				case "tool":
					return "tool-operation"
				case "api_req_failed":
				case "mistake_limit_reached":
				case "auto_approval_max_req_reached":
					return "error"
				case "resume_task":
				case "resume_completed_task":
					return "subtask"
				default:
					return "unknown"
			}
		}

		// Say message types
		if (message.type === "say") {
			const say = (message as any).say

			// User input
			if (say === "user_feedback" || say === "user_feedback_diff") {
				return "user-input"
			}

			// Agent response
			if (say === "text") {
				return "agent-response"
			}

			// Reasoning/thinking
			if (say === "reasoning") {
				return "thinking"
			}

			// API operations
			if (say?.startsWith("api_req_")) {
				return "api-request"
			}

			// Browser operations
			if (say === "browser_action" || say === "browser_action_result") {
				return "browser-action"
			}

			// MCP operations
			if (say === "mcp_server_request_started" || say === "mcp_server_response") {
				return "mcp-operation"
			}

			// Context operations
			if (say === "condense_context" || say === "condense_context_error") {
				return "context"
			}

			// Checkpoint operations
			if (say === "checkpoint_saved") {
				return "checkpoint"
			}

			// Subtask operations
			if (say === "subtask_result") {
				return "subtask"
			}

			// Error messages
			if (say?.includes("error")) {
				return "error"
			}

			// System status
			if (["api_req_finished", "shell_integration_warning", "codebase_search_result"].includes(say)) {
				return "system"
			}

			// Check for tool operations in JSON
			const toolData = this.tryParseJson(message.text)
			if (toolData && toolData.tool) {
				return "tool-operation"
			}

			// Check for questions
			if (toolData && toolData.question) {
				return "completion"
			}
		}

		return "unknown"
	}

	private tryParseJson(text?: string): any {
		if (!text) return null
		try {
			return JSON.parse(text)
		} catch {
			return null
		}
	}
}
