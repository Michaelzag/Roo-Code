import React from "react"
import type { ClineMessage } from "@roo-code/types"
import { safeJsonParse } from "@roo/safeJsonParse"
import { Markdown } from "../Markdown"

interface BrowserContentProps {
	message: ClineMessage
	padding?: string
}

/**
 * BrowserContent - Content component for browser operations
 * Tries to parse JSON for structured data, falls back to markdown
 */
export const BrowserContent: React.FC<BrowserContentProps> = ({ message, padding = "p-4" }) => {
	// Try to parse as JSON first
	const parsedData = safeJsonParse<any>(message.text)

	// If it's JSON with browser action data, show structured info
	if (parsedData && typeof parsedData === "object") {
		if (parsedData.tool === "browser_action" || parsedData.action) {
			const action = parsedData.action || "unknown"
			const url = parsedData.url
			const coordinate = parsedData.coordinate
			const text = parsedData.text

			return (
				<div className={padding}>
					<div className="text-sm text-vscode-foreground leading-relaxed mb-2">
						{action === "launch" && url && `Launch browser at ${url}`}
						{action === "click" && coordinate && `Click at ${coordinate}`}
						{action === "type" && text && `Type: "${text}"`}
						{action === "key" && text && `Press key: ${text}`}
						{action === "scroll" && coordinate && `Scroll ${coordinate}`}
						{action === "screenshot" && "Take screenshot"}
						{action === "close" && "Close browser"}
						{!["launch", "click", "type", "key", "scroll", "screenshot", "close"].includes(action) &&
							`Browser action: ${action}`}
					</div>
					{url && action === "launch" && (
						<div className="text-xs text-vscode-descriptionForeground font-mono">{url}</div>
					)}
				</div>
			)
		}
	}

	// Fallback to markdown rendering
	return (
		<div className={padding}>
			<div className="chat-content-typography">
				<Markdown markdown={message.text || ""} partial={message.partial} />
			</div>
		</div>
	)
}
