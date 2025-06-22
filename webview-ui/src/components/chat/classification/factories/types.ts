import type { ClineMessage, ClineSay } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"

/**
 * Structured data models for parsed messages
 * These replace raw JSON parsing with meaningful, typed data structures
 */

export interface ParsedToolOperation {
	name: string
	path?: string
	content?: string
	diff?: string
	isSuccess: boolean
	isProtected?: boolean
	isOutsideWorkspace?: boolean
	metadata: Record<string, any>
}

export interface ParsedErrorInfo {
	type: "diff-error" | "rooignore-error" | "system-error" | "api-error"
	message: string
	details?: string
	isGeneric: boolean
	hasSpecificError?: boolean
}

export interface ParsedUserInput {
	text: string
	hasImages?: boolean
	isDiff?: boolean
}

export interface ParsedApiRequest {
	type: "started" | "finished" | "retried" | "delayed" | "deleted" | "failed"
	cost?: number
	tokensIn?: number
	tokensOut?: number
	cancelReason?: string
	streamingFailedMessage?: string
}

export interface ParsedMcpOperation {
	type: "request-started" | "response"
	serverName?: string
	toolName?: string
	arguments?: string
	response?: string
}

export interface ParsedBrowserAction {
	action: string
	coordinate?: string
	size?: string
	text?: string
	screenshot?: string
	logs?: string
	currentUrl?: string
}

export interface ParsedCommandOperation {
	command?: string
	output?: string
	isOutput: boolean
}

/**
 * Unified parsed message structure
 * All messages are parsed into this structured format
 */
export interface ParsedMessage {
	raw: ClineMessage
	type:
		| "tool-operation"
		| "error"
		| "user-input"
		| "agent-response"
		| "api-request"
		| "mcp-operation"
		| "browser-action"
		| "command"
		| "system"
		| "completion"
		| "thinking"
		| "context"
		| "checkpoint"
		| "subtask"
		| "unknown"

	// Structured data based on type
	tool?: ParsedToolOperation
	error?: ParsedErrorInfo
	userInput?: ParsedUserInput
	apiRequest?: ParsedApiRequest
	mcpOperation?: ParsedMcpOperation
	browserAction?: ParsedBrowserAction
	command?: ParsedCommandOperation

	// Common fields
	text?: string
	isStreaming?: boolean
	isPartial?: boolean
	timestamp: number

	// Metadata for comprehensive parsing
	metadata?: Record<string, any>
}

/**
 * Factory interface for parsing messages
 * Each parser handles one specific message type/pattern
 */
export interface MessageParserFactory {
	/**
	 * Determines if this parser can handle the given message
	 */
	canParse(message: ClineMessage): boolean

	/**
	 * Parses the message into structured data
	 */
	parse(message: ClineMessage): ParsedMessage

	/**
	 * Priority for parser selection (higher = checked first)
	 */
	priority: number

	/**
	 * Human-readable name for debugging
	 */
	name: string
}

/**
 * Factory interface for classifying parsed messages
 * Each classifier handles one semantic type
 */
export interface ClassificationFactory {
	/**
	 * Determines if this classifier can handle the parsed message
	 */
	canClassify(parsed: ParsedMessage): boolean

	/**
	 * Classifies the parsed message into a message style
	 */
	classify(parsed: ParsedMessage): MessageStyle

	/**
	 * Priority for classifier selection (higher = checked first)
	 */
	priority: number

	/**
	 * Human-readable name for debugging
	 */
	name: string
}

/**
 * Registry for managing parsers and classifiers
 */
export interface FactoryRegistry {
	// Parser management
	registerParser(parser: MessageParserFactory): void
	unregisterParser(name: string): void
	findParser(message: ClineMessage): MessageParserFactory | null

	// Classifier management
	registerClassifier(classifier: ClassificationFactory): void
	unregisterClassifier(name: string): void
	findClassifier(parsed: ParsedMessage): ClassificationFactory | null

	// Processing pipeline
	parseMessage(message: ClineMessage): ParsedMessage
	classifyMessage(message: ClineMessage): MessageStyle
}

/**
 * Configuration for error handling
 */
export interface ErrorHandlingConfig {
	suppressGenericErrors: boolean
	detectDuplicateErrors: boolean
	specificErrorTypes: Set<ClineSay>
}

/**
 * Configuration for success detection
 */
export interface SuccessDetectionConfig {
	successIndicators: Array<(data: any) => boolean>
	failureIndicators: Array<(data: any) => boolean>
}
