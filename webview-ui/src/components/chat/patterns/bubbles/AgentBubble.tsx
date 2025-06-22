import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { SmartContentRenderer } from "./shared/BubbleContent"

/**
 * AgentContent - Smart content that automatically detects and renders markdown
 */
const AgentContent: React.FC<{
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
 * AgentBubble - Uses shared bubble factory with agent-response semantic
 * Always enforces green color with left-aligned agent variant.
 */
export const AgentBubble = createBubbleComponent("agent-response", "green")(AgentContent)
