import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { ExpandableBubbleContent } from "./shared/BubbleContent"

const FileWriteContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	onToggleExpand?: (ts: number) => void
}> = ({ message, classification }) => {
	return (
		<ExpandableBubbleContent
			message={message}
			classification={classification}
			icon="edit"
			title="Roo wants to modify files"
			expanded={true}
		/>
	)
}

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
