import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * CheckpointContent - Uses shared simple content
 */
const CheckpointContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message }) => {
	return (
		<SimpleBubbleContent
			message={message}
			classification={{} as MessageStyle} // Will be set by BubbleUnified
			icon="milestone"
			title="Checkpoint"
		/>
	)
}

/**
 * CheckpointBubble - Uses shared bubble factory with checkpoint semantic
 */
export const CheckpointBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"checkpoint",
	"green",
)(CheckpointContent)
