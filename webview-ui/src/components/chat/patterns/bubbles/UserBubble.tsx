import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { SmartContentRenderer } from "./shared/BubbleContent"

/**
 * UserContent - Smart content that automatically detects and renders markdown with universal content limiting
 */
const UserContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	contentLimits?: any
}> = ({ message, classification, contentLimits }) => {
	return (
		<div className="p-3">
			<SmartContentRenderer message={message} semantic={classification?.semantic} contentLimits={contentLimits} />
		</div>
	)
}

/**
 * UserBubble - Uses shared bubble factory with user-input semantic
 * Always enforces blue color with right-aligned user variant.
 */
export const UserBubble = createBubbleComponent("user-input", "blue", {
	maxLines: 30, // Limit long user messages
	previewLines: 10, // Show good preview for context
})(UserContent)
