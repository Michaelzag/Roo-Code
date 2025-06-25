import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../../../theme/chatDefaults"
import { Markdown } from "../../../../Markdown"
import { AutoFormattedContent } from "../ThemedComponents"
import { BaseContainer } from "../base/BaseContainer"
import { BaseHeader } from "../base/BaseHeader"
import { BaseContent } from "../base/BaseContent"

/**
 * Standard simple content component with header and body
 * Now uses shared base components for consistent styling
 */
export const SimpleBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	renderContent?: (message: ClineMessage) => React.ReactNode
}> = ({ message, classification, icon, title, renderContent }) => {
	return (
		<BaseContainer classification={classification}>
			<BaseHeader icon={icon} title={title} classification={classification} />

			<BaseContent classification={classification}>
				{renderContent ? (
					renderContent(message)
				) : message.text && message.text.trim() ? (
					<AutoFormattedContent semantic={classification?.semantic} content={message.text} />
				) : (
					<Markdown markdown={message.text || ""} partial={message.partial} />
				)}
			</BaseContent>
		</BaseContainer>
	)
}
