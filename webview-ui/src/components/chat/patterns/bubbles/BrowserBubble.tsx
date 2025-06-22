import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * BrowserContent - Uses shared simple content
 */
const BrowserContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message }) => {
	return (
		<SimpleBubbleContent
			message={message}
			classification={{} as MessageStyle} // Will be set by BubbleUnified
			icon="browser"
			title="Browser Operation"
		/>
	)
}

/**
 * BrowserBubble - Uses shared bubble factory with browser semantic
 */
export const BrowserBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"browser",
	"blue",
)(BrowserContent)
