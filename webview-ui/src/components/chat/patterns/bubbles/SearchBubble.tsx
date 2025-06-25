import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import type { ExpandableBubbleProps } from "./types"

interface SearchBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

/**
 * SearchContent - Uses shared timestamp-based expandable content
 */
const SearchContent: React.FC<{
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
			icon="search"
			title="Search"
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
		/>
	)
}

/**
 * SearchBubble - Uses shared bubble factory with search semantic
 */
export const SearchBubble: React.FC<SearchBubbleProps> = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}>(
	"search",
	"pink",
)(SearchContent)
