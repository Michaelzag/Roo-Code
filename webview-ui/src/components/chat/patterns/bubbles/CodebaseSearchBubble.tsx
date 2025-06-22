import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * CodebaseSearchContent - Uses shared simple content
 */
const CodebaseSearchContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message }) => {
	return (
		<SimpleBubbleContent
			message={message}
			classification={{} as MessageStyle} // Will be set by BubbleUnified
			icon="search"
			title="Codebase Search"
		/>
	)
}

/**
 * CodebaseSearchBubble - Uses shared bubble factory with codebase-search semantic
 */
export const CodebaseSearchBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"codebase-search",
	"indigo",
)(CodebaseSearchContent)
