import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import RooLogo from "./shared/RooLogo"
import { BaseHeader } from "./shared/base/BaseHeader"
import { BaseContent } from "./shared/base/BaseContent"
import { SmartContentRenderer } from "./shared/renderers/SmartContentRenderer"

/**
 * AgentContent - Smart content that automatically detects and renders markdown with universal content limiting
 * Uses base components directly to avoid double bubble nesting
 */
const AgentContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	contentLimits?: any
}> = ({ message, classification, contentLimits }) => {
	return (
		<>
			<BaseHeader icon={<RooLogo />} title="Roo" classification={classification} />
			<BaseContent classification={classification}>
				<SmartContentRenderer
					message={message}
					semantic={classification?.semantic}
					contentLimits={contentLimits}
				/>
			</BaseContent>
		</>
	)
}

/**
 * AgentBubble - Uses shared bubble factory with agent-response semantic
 * Always enforces green color with left-aligned agent variant.
 */
export const AgentBubble = createBubbleComponent("agent-response", "green", {
	maxLines: 50, // Agent responses can be longer than user messages
	previewLines: 15, // Show more preview context for agent responses
})(AgentContent)
