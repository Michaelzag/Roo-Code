import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * FileWriteContent - Uses shared timestamp-based expandable content with smart content detection
 *
 * The SmartContentRenderer automatically detects and renders:
 * - batchDiffs arrays for multiple file modifications
 * - Single file operations
 * - Proper file lists with change counts and formatting
 */
const FileWriteContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}> = ({ message, classification, isExpanded, onToggleExpand }) => {
	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="edit"
			title="Roo wants to modify files"
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
			// SmartContentRenderer automatically handles:
			// - tool.batchDiffs arrays (shows files with change counts)
			// - tool.path single files
			// - Proper parsing and formatting
		/>
	)
}

/**
 * FileWriteBubble - Uses shared bubble factory with file-write semantic
 */
export const FileWriteBubble = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}>(
	"file-write",
	"orange",
)(FileWriteContent)
