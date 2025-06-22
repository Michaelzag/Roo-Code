import React from "react"
import type { ClineMessage } from "@roo-code/types"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineApiReqInfo } from "@roo/ExtensionMessage"
import { useFactoryMessageClassification } from "./classification/useFactoryMessageClassification"
import { useChatTheme } from "./theme/useChatTheme"

// Import unified pattern components
import { BubbleUnified } from "./patterns/BubbleUnified"
import { StatusBar } from "./patterns/StatusBar"

// Import semantic bubble components
import { ThinkingBubble, ErrorBubble, UserBubble, AgentBubble } from "./patterns/bubbles"

// Import semantic bubble components
import { FileReadBubble } from "./patterns/bubbles/FileReadBubble"
import { FileWriteBubble } from "./patterns/bubbles/FileWriteBubble"
import { FileSearchBubble } from "./patterns/bubbles/FileSearchBubble"
import { ModeChangeBubble } from "./patterns/bubbles/ModeChangeBubble"
import { CommandBubble } from "./patterns/bubbles/CommandBubble"
import { SearchBubble } from "./patterns/bubbles/SearchBubble"
import { CompletionBubble } from "./patterns/bubbles/CompletionBubble"
import { BrowserBubble } from "./patterns/bubbles/BrowserBubble"
import { McpBubble } from "./patterns/bubbles/McpBubble"
import { ApiBubble } from "./patterns/bubbles/ApiBubble"
import { SubtaskBubble } from "./patterns/bubbles/SubtaskBubble"
import { ContextBubble } from "./patterns/bubbles/ContextBubble"
import { CheckpointBubble } from "./patterns/bubbles/CheckpointBubble"
import { DefaultBubble } from "./patterns/bubbles/DefaultBubble"

// Import override components
import { ApiRequestCard } from "./patterns/overrides/ApiRequestCard"
import { TaskCompletedRow } from "./patterns/overrides/TaskCompletedRow"
import {
	ContextCondenseRow,
	CondensingContextRow,
	CondenseContextErrorRow,
} from "./patterns/overrides/ContextCondenseRow"

export interface ChatMessageProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	onToggleExpand: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}

/**
 * ChatMessage - Message Router
 *
 * Routes messages to appropriate components based on their classification.
 * Uses the unified Bubble foundation and specialized components.
 *
 * Features:
 * - Consistent styling through BubbleUnified foundation
 * - Specialized components for different message types
 * - Easy to extend with new message types
 * - Comprehensive error handling and fallbacks
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({ message, ...props }) => {
	const { classifyMessage } = useFactoryMessageClassification()
	const { getMessageClasses } = useChatTheme()

	const style = classifyMessage(message)
	const className = getMessageClasses(style, message)

	// Handle component overrides first
	if (style.type === "component-override") {
		switch (style.component) {
			case "api-request":
				return (
					<ApiRequestCard
						message={message}
						// Extract cost and other props from message
						cost={message.text ? safeJsonParse<ClineApiReqInfo>(message.text)?.cost : undefined}
						cancelReason={
							message.text ? safeJsonParse<ClineApiReqInfo>(message.text)?.cancelReason : undefined
						}
						streamingFailedMessage={
							message.text
								? safeJsonParse<ClineApiReqInfo>(message.text)?.streamingFailedMessage
								: undefined
						}
						apiRequestFailedMessage={
							props.lastModifiedMessage?.ask === "api_req_failed"
								? props.lastModifiedMessage?.text
								: undefined
						}
						isExpanded={props.isExpanded}
						isLast={props.isLast}
						onToggleExpand={() => props.onToggleExpand(message.ts)}
					/>
				)

			case "context-condense": {
				// Handle different types of context condensing
				if (message.say === "condense_context_error") {
					return <CondenseContextErrorRow errorText={message.text} />
				}

				if (message.partial) {
					return <CondensingContextRow />
				}

				// Parse the structured data for completed condensing
				const contextData = (message as any).contextCondense
				if (contextData && contextData.cost !== undefined && contextData.prevContextTokens !== undefined) {
					return (
						<ContextCondenseRow
							cost={contextData.cost}
							prevContextTokens={contextData.prevContextTokens}
							newContextTokens={contextData.newContextTokens}
							summary={contextData.summary || ""}
						/>
					)
				}

				// Fallback for malformed context condense data
				return <CondensingContextRow />
			}

			case "task-completed":
				return <TaskCompletedRow text={message.text} />

			default:
				// Fallback for unknown overrides - use standard pattern
				console.warn(`Unknown component override: ${style.component}`)
				return (
					<div className="p-2 bg-yellow-100 border border-yellow-300 rounded">
						<div className="text-yellow-800 text-sm">Unknown component override: {style.component}</div>
					</div>
				)
		}
	}

	// Handle semantic overrides (styled differently than semantic meaning)
	if (style.type === "semantic-override") {
		switch (style.semantic) {
			case "mode-change":
				// For subtask results, use a simple success bubble
				return (
					<BubbleUnified
						message={message}
						classification={{ ...style, variant: "work" }}
						className={className}
					/>
				)

			default:
				// For unknown semantic overrides, fall back to standard pattern
				console.warn(`Unknown semantic override: ${style.semantic}, falling back to standard pattern`)
				// Continue to standard pattern handling below
				break
		}
	}

	// Handle standard patterns
	if (style.type === "standard" && style.pattern) {
		switch (style.pattern) {
			case "bubble": {
				const variant = style.variant || "work"

				// Route to appropriate bubble component
				switch (variant) {
					case "user":
						return <UserBubble message={message} className={className} />

					case "agent":
						return <AgentBubble message={message} className={className} />

					case "work": {
						// Route to semantic bubbles based on semantic type
						const bubbleProps = {
							isExpanded: props.isExpanded,
							isLast: props.isLast,
							isStreaming: props.isStreaming,
							onToggleExpand: () => props.onToggleExpand(message.ts),
							onBatchFileResponse: props.onBatchFileResponse,
						}

						// Use semantic type for routing - proper architecture!
						switch (style.semantic) {
							case "thinking":
								return (
									<ThinkingBubble
										message={message}
										classification={style}
										expanded={props.isExpanded}
										onToggleExpand={bubbleProps.onToggleExpand}
									/>
								)

							case "error":
								return (
									<ErrorBubble
										message={message}
										classification={style}
										expanded={props.isExpanded}
										onToggleExpand={bubbleProps.onToggleExpand}
									/>
								)

							case "completion":
								return (
									<CompletionBubble
										message={message}
										classification={style}
										onSuggestionClick={props.onSuggestionClick}
									/>
								)

							case "file-read":
								return <FileReadBubble message={message} classification={style} {...bubbleProps} />

							case "file-write":
								return <FileWriteBubble message={message} classification={style} {...bubbleProps} />

							case "file-search":
								return <FileSearchBubble message={message} classification={style} {...bubbleProps} />

							case "mode-change":
								return <ModeChangeBubble message={message} classification={style} />

							case "command":
								return <CommandBubble message={message} classification={style} {...bubbleProps} />

							case "search":
							case "codebase-search":
								return <SearchBubble message={message} classification={style} {...bubbleProps} />

							case "browser":
								return <BrowserBubble message={message} classification={style} {...bubbleProps} />

							case "mcp":
								return <McpBubble message={message} classification={style} {...bubbleProps} />

							case "api":
								return <ApiBubble message={message} classification={style} {...bubbleProps} />

							case "subtask":
								return <SubtaskBubble message={message} classification={style} {...bubbleProps} />

							case "context":
								return <ContextBubble message={message} classification={style} {...bubbleProps} />

							case "checkpoint":
								return <CheckpointBubble message={message} classification={style} {...bubbleProps} />

							default:
								// Fallback to DefaultBubble for unknown semantic types
								console.warn(`Unknown semantic type: ${style.semantic}, falling back to DefaultBubble`)
								return <DefaultBubble message={message} classification={style} className={className} />
						}
					}

					default: {
						// Fallback to unified bubble
						return <BubbleUnified message={message} classification={style} className={className} />
					}
				}
			}

			case "status-bar": {
				const statusBarComponent = <StatusBar message={message} className={className} />
				// StatusBar might return null for empty messages
				return statusBarComponent
			}

			default: {
				// Fallback for unknown patterns - use status bar as safe default
				console.warn(`Unknown pattern: ${style.pattern}, using status bar fallback`)
				const fallbackComponent = <StatusBar message={message} className={className} />
				// StatusBar might return null for empty messages
				return fallbackComponent
			}
		}
	}

	// Final fallback - should rarely be reached due to comprehensive classification
	console.error("Message classification failed completely:", { message, style })
	return (
		<div className="p-2 bg-red-100 border border-red-300 rounded">
			<div className="text-red-800 text-sm font-semibold">⚠️ Classification Error</div>
			<div className="text-red-600 text-xs mt-1 font-mono">
				Type: {message.type} | {message.type === "ask" ? `Ask: ${message.ask}` : `Say: ${(message as any).say}`}
			</div>
			<div className="text-red-500 text-xs mt-1">Please report this issue. Style: {JSON.stringify(style)}</div>
		</div>
	)
}
