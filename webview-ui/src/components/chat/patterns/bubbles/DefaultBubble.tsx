import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { Markdown } from "../../Markdown"

/**
 * DefaultContent - Simple fallback content with informative message
 */
const DefaultContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
}> = ({ message, classification }) => {
	return (
		<div className="p-4">
			<div className="flex items-center mb-3">
				<span className="codicon codicon-info mr-2 text-sm" />
				<span className="text-sm font-medium">Unknown Message Type</span>
				{classification.semantic && (
					<span className="ml-2 text-xs opacity-70 bg-vscode-badge-background text-vscode-badge-foreground px-2 py-1 rounded">
						{classification.semantic}
					</span>
				)}
			</div>

			<div className="text-sm text-vscode-foreground leading-relaxed">
				<Markdown markdown={message.text || "No content available"} partial={message.partial} />
			</div>
		</div>
	)
}

/**
 * DefaultBubble - Clean fallback bubble with grey styling
 *
 * Used as a safety net for unknown semantic types or edge cases.
 * Provides consistent bubble styling while clearly indicating the fallback state.
 * Uses 'context' semantic type since it's already grey-colored.
 */
export const DefaultBubble = createBubbleComponent("context", "gray")(DefaultContent)
