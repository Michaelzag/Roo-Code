import React from "react"
import type { ClineMessage } from "@roo-code/types"
import { Markdown } from "../Markdown"

interface SimpleContentProps {
	message: ClineMessage
	padding?: string
}

/**
 * SimpleContent - Shared content component for basic markdown rendering
 *
 * Used by bubbles that just need to display markdown text with standard styling.
 * Uses theme-based typography classes instead of hardcoded styles.
 */
export const SimpleContent: React.FC<SimpleContentProps> = ({ message, padding = "p-4" }) => (
	<div className={padding}>
		<div className="chat-content-typography">
			<Markdown markdown={message.text || ""} partial={message.partial} />
		</div>
	</div>
)
