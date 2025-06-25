import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { ExpandableBubbleContent } from "./shared/BubbleContent"

const FileReadContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	onToggleExpand?: (ts: number) => void
}> = ({ message, classification }) => {
	return (
		<ExpandableBubbleContent
			message={message}
			classification={classification}
			icon="file"
			title="Roo wants to read files"
			expanded={true}
		/>
	)
}

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
