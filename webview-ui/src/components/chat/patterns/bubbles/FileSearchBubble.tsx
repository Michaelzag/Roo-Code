import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { ExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * FileSearchContent - Uses shared expandable content with smart content detection
 *
 * The SmartContentRenderer automatically detects and renders:
 * - results arrays with search matches
 * - File paths with line snippets
 * - Proper search result formatting
 */
const FileSearchContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}> = ({ message, classification }) => {
	return (
		<ExpandableBubbleContent
			message={message}
			classification={classification}
			icon="search"
			title="Roo searched for files"
			expanded={true}
			// SmartContentRenderer automatically handles:
			// - tool.results arrays (shows search results with line snippets)
			// - Search patterns and file matches
			// - Proper formatting and icons
		/>
	)
}

/**
 * FileSearchBubble - Uses shared bubble factory with file-search semantic
 */
export const FileSearchBubble = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}>(
	"file-search",
	"teal",
)(FileSearchContent)
