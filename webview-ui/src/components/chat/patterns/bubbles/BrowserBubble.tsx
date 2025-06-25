import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { safeJsonParse } from "@roo/safeJsonParse"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * BrowserContent - Uses shared simple content with proper JSON parsing
 */
const BrowserContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification }) => {
	// Quick check: must look like JSON before attempting to parse
	const text = message.text?.trim()
	const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

	// Parse browser action data from message text only if it looks like JSON
	const browserData = isValidJson ? safeJsonParse<any>(message.text, {}) : {}

	// Create formatted content following the established pattern
	const formatBrowserContent = () => {
		// If not valid JSON, show plain text
		if (!isValidJson) {
			return <div className="text-sm text-vscode-foreground">{message.text || "No browser action data"}</div>
		}
		// Extract meaningful browser information if available
		const action = browserData?.action || browserData?.tool
		const coordinate = browserData?.coordinate
		const text = browserData?.text
		const url = browserData?.url

		return (
			<div className="space-y-3">
				{/* Browser action */}
				{action && (
					<div className="flex items-center gap-2">
						<span className="codicon codicon-browser text-xs opacity-70" />
						<span className="text-sm font-medium capitalize">{action.replace(/_/g, " ")}</span>
					</div>
				)}

				{/* URL if available */}
				{url && (
					<div className="space-y-1">
						<div className="text-xs opacity-70 font-medium">URL:</div>
						<div className="text-sm font-mono text-blue-400 break-all">{url}</div>
					</div>
				)}

				{/* Coordinates if available */}
				{coordinate && (
					<div className="flex items-center gap-2">
						<span className="codicon codicon-target text-xs opacity-70" />
						<span className="text-sm font-mono">
							({coordinate[0]}, {coordinate[1]})
						</span>
					</div>
				)}

				{/* Text input if available */}
				{text && (
					<div className="space-y-1">
						<div className="text-xs opacity-70 font-medium">Text:</div>
						<div className="bg-vscode-textCodeBlock-background border border-vscode-panel-border rounded p-2 text-sm max-h-24 overflow-auto">
							{text}
						</div>
					</div>
				)}
			</div>
		)
	}

	return (
		<SimpleBubbleContent
			message={message}
			classification={classification}
			icon="browser"
			title="Browser Action"
			renderContent={formatBrowserContent}
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
