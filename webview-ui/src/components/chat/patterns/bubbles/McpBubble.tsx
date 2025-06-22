import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * McpContent - Uses shared simple content
 */
const McpContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message }) => {
	return (
		<SimpleBubbleContent
			message={message}
			classification={{} as MessageStyle} // Will be set by BubbleUnified
			icon="extensions"
			title="MCP Operation"
		/>
	)
}

/**
 * McpBubble - Uses shared bubble factory with mcp semantic
 */
export const McpBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"mcp",
	"purple",
)(McpContent)
