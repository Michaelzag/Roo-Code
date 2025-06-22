import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * FileReadContent - Uses shared timestamp-based expandable content with smart content detection
 *
 * The SmartContentRenderer in TimestampExpandableBubbleContent automatically detects and renders:
 * - batchFiles arrays for multiple file operations
 * - Single file operations
 * - Proper file lists with icons and formatting
 */
const FileReadContent: React.FC<{
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
			icon="file"
			title="Roo wants to read files"
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
			// SmartContentRenderer automatically handles:
			// - tool.batchFiles arrays (shows clean file list)
			// - tool.path single files
			// - Proper parsing and formatting
		/>
	)
}

/**
 * FileReadBubble - Uses shared bubble factory with file-read semantic
 */
export const FileReadBubble = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}>(
	"file-read",
	"cyan",
)(FileReadContent)
