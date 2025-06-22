import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { SmartContentRenderer } from "./shared/BubbleContent"

/**
 * UserContent - Smart content that automatically detects and renders markdown
 */
const UserContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
}> = ({ message, classification }) => {
	return (
		<div className="p-3">
			<SmartContentRenderer message={message} semantic={classification?.semantic} />
		</div>
	)
}

/**
 * UserBubble - Uses shared bubble factory with user-input semantic
 * Always enforces blue color with right-aligned user variant.
 */
export const UserBubble = createBubbleComponent("user-input", "blue")(UserContent)
