import type { ClineMessage } from "@roo-code/types"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { MessageParserFactory, ParsedMessage, ParsedToolOperation } from "../types"

/**
 * Parser for tool operations (successful and failed)
 * Handles both ask:tool and say messages with tool JSON
 * Intelligently detects success vs failure to solve the duplicate error issue
 */
export class ToolOperationParser implements MessageParserFactory {
	name = "ToolOperationParser"
	priority = 100 // High priority - should run early

	canParse(message: ClineMessage): boolean {
		// Handle ask:tool messages
		if (message.type === "ask" && message.ask === "tool") {
			const toolData = safeJsonParse<any>(message.text)
			return !!(toolData && toolData.tool)
		}

		// Handle say messages that contain tool JSON
		if (message.type === "say" && message.text) {
			const toolData = safeJsonParse<any>(message.text)
			return !!(toolData && toolData.tool)
		}

		return false
	}

	parse(message: ClineMessage): ParsedMessage {
		const toolData = safeJsonParse<any>(message.text)

		if (!toolData || !toolData.tool) {
			// Fallback for malformed tool data
			return {
				raw: message,
				type: "unknown",
				text: message.text,
				timestamp: message.ts,
			}
		}

		// Determine if this is a successful operation
		const isSuccess = this.detectSuccess(toolData, message)

		const parsedTool: ParsedToolOperation = {
			name: toolData.tool,
			path: toolData.path,
			content: toolData.content,
			diff: toolData.diff,
			isSuccess,
			isProtected: toolData.isProtected,
			isOutsideWorkspace: toolData.isOutsideWorkspace,
			metadata: {
				...toolData,
				originalMessageType: message.type,
				originalSay: (message as any).say,
			},
		}

		return {
			raw: message,
			type: "tool-operation",
			tool: parsedTool,
			text: message.text,
			isPartial: message.partial,
			timestamp: message.ts,
		}
	}

	/**
	 * Intelligent success detection
	 * This is the key to solving the duplicate error issue
	 */
	private detectSuccess(toolData: any, message: ClineMessage): boolean {
		// If the message is say:error, it's likely misclassified success
		// Check for success indicators in the JSON
		if (message.type === "say" && (message as any).say === "error") {
			return this.hasSuccessIndicators(toolData) && !this.hasFailureIndicators(toolData)
		}

		// ask:tool messages are typically successful operations requesting approval
		if (message.type === "ask" && message.ask === "tool") {
			return true
		}

		// For other say messages, check indicators
		return this.hasSuccessIndicators(toolData) && !this.hasFailureIndicators(toolData)
	}

	private hasSuccessIndicators(toolData: any): boolean {
		// Success indicators: has expected fields, no error markers
		return !!(
			toolData.tool &&
			// File operations with path/content indicate success
			(toolData.path !== undefined ||
				toolData.content !== undefined ||
				toolData.diff !== undefined ||
				// Search operations with results
				toolData.query !== undefined ||
				toolData.regex !== undefined ||
				// Command operations
				toolData.command !== undefined ||
				// Mode operations
				toolData.mode !== undefined)
		)
	}

	private hasFailureIndicators(toolData: any): boolean {
		// Failure indicators: explicit error fields
		return !!(toolData.error || toolData.failed || toolData.errorMessage || toolData.errorDetails)
	}
}
