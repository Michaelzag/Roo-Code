import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import type { ClineSayTool } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * FileSearchContent - Uses shared timestamp-based expandable content
 */
const FileSearchContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}> = ({ message, isExpanded, onToggleExpand }) => {
	const tool = safeJsonParse<ClineSayTool>(message.text)

	// Extract search information if available
	const searchTerm = tool?.regex || "files"

	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={{} as MessageStyle} // Will be set by BubbleUnified
			icon="search"
			title={`File Search: ${searchTerm}`}
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
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
