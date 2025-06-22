import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * TaskCompletedContent - Simple content that just renders message text with celebration theme
 */
const TaskCompletedContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
}> = ({ message }) => {
	return <div className="p-4">{message.text}</div>
}

/**
 * TaskCompletedBubble - Uses shared bubble factory with completion semantic
 * Uses celebration theme for enhanced visual treatment.
 */
export const TaskCompletedBubble = createBubbleComponent("completion", "green")(TaskCompletedContent)
