import type { ClineMessage, ClineSay } from "@roo-code/types"
import type { MessageParserFactory, ParsedMessage, ParsedErrorInfo } from "../types"

/**
 * Parser for error messages - handles both generic and specific errors
 * Solves the duplicate error bubble issue by detecting and suppressing generic errors
 */
export class ErrorMessageParser implements MessageParserFactory {
	name = "ErrorMessageParser"
	priority = 90 // High priority, but after tool parser

	// Known specific error types that provide detailed information
	private specificErrorTypes: Set<ClineSay> = new Set([
		"diff_error" as const,
		"rooignore_error" as const,
		"condense_context_error" as const,
	])

	canParse(message: ClineMessage): boolean {
		if (message.type !== "say") return false

		// Handle specific error types
		if (message.say && this.specificErrorTypes.has(message.say)) {
			return true
		}

		// Handle generic error messages
		if (message.say === "error") {
			return true
		}

		return false
	}

	parse(message: ClineMessage): ParsedMessage {
		const errorType = this.determineErrorType(message)
		const isGeneric = message.say === "error"

		const parsedError: ParsedErrorInfo = {
			type: errorType,
			message: message.text || "Unknown error occurred",
			details: this.extractErrorDetails(message),
			isGeneric,
			hasSpecificError: this.hasSpecificErrorInSameTimeframe(message),
		}

		return {
			raw: message,
			type: "error",
			error: parsedError,
			text: message.text,
			timestamp: message.ts,
		}
	}

	private determineErrorType(message: ClineMessage): ParsedErrorInfo["type"] {
		switch (message.say) {
			case "diff_error":
				return "diff-error"
			case "rooignore_error":
				return "rooignore-error"
			case "error":
				// For generic errors, try to determine type from content
				if (message.text?.toLowerCase().includes("diff")) {
					return "diff-error"
				}
				if (
					message.text?.toLowerCase().includes("protected") ||
					message.text?.toLowerCase().includes("rooignore")
				) {
					return "rooignore-error"
				}
				if (message.text?.toLowerCase().includes("api")) {
					return "api-error"
				}
				return "system-error"
			default:
				return "system-error"
		}
	}

	private extractErrorDetails(message: ClineMessage): string | undefined {
		// For specific error types, the entire text is usually the details
		if (message.say !== "error" && message.text) {
			return message.text
		}

		// For generic errors, try to extract meaningful details
		if (message.text) {
			// If it's JSON, try to extract relevant fields
			try {
				const parsed = JSON.parse(message.text)
				return parsed.errorDetails || parsed.details || parsed.message
			} catch {
				// Not JSON, return as-is
				return message.text
			}
		}

		return undefined
	}

	/**
	 * Detect if there might be a specific error message for the same operation
	 * This helps with the duplicate error suppression strategy
	 */
	private hasSpecificErrorInSameTimeframe(message: ClineMessage): boolean {
		// This is a simplified check - in a real implementation, you might
		// check a sliding window of recent messages or maintain state

		// For generic errors, only assume specific counterparts if the JSON is valid
		// and contains tool information (indicating a successful operation was misclassified)
		if (message.say === "error" && message.text) {
			try {
				const parsed = JSON.parse(message.text)
				// If it has tool info, it's likely a misclassified success that has a specific error
				return !!(parsed && typeof parsed === "object" && parsed.tool)
			} catch {
				// Malformed JSON means it's a genuine error, not a misclassified success
				return false
			}
		}

		return false
	}
}
