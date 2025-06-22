import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import type { ClineSayTool } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * FileWriteContent - Uses shared timestamp-based expandable content
 */
const FileWriteContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}> = ({ message, isExpanded, onToggleExpand }) => {
	const tool = safeJsonParse<ClineSayTool>(message.text)

	// Extract file information if available
	const fileName = tool?.path || "file"

	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={{} as MessageStyle} // Will be set by BubbleUnified
			icon="edit"
			title={`File Write: ${fileName}`}
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
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
