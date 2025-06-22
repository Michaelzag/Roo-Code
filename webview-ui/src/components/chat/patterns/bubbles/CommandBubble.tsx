import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import type { ExpandableBubbleProps } from "./types"

interface CommandBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

/**
 * CommandContent - Uses shared timestamp-based expandable content with smart content detection
 *
 * The SmartContentRenderer automatically detects and renders:
 * - Command strings with proper code formatting
 * - JSON command objects with command extraction
 * - Proper bash syntax highlighting
 */
const CommandContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}> = ({ message, classification, isExpanded, onToggleExpand }) => {
	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="terminal"
			title="Roo executed a command"
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
			// SmartContentRenderer automatically handles:
			// - Command parsing from JSON or plain text
			// - Proper code block formatting with bash highlighting
			// - Command badges and semantic styling
		/>
	)
}

/**
 * CommandBubble - Uses shared bubble factory with command semantic
 */
export const CommandBubble: React.FC<CommandBubbleProps> = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}>(
	"command",
	"gray",
)(CommandContent)
