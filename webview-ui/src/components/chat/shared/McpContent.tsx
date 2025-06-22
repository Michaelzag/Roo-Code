import React from "react"
import type { ClineMessage } from "@roo-code/types"
import { safeJsonParse } from "@roo/safeJsonParse"
import { Markdown } from "../Markdown"

interface McpContentProps {
	message: ClineMessage
	padding?: string
}

/**
 * McpContent - Content component for MCP operations
 * Tries to parse JSON for structured data, falls back to markdown
 */
export const McpContent: React.FC<McpContentProps> = ({ message, padding = "p-4" }) => {
	// Try to parse as JSON first
	const parsedData = safeJsonParse<any>(message.text)

	// If it's JSON with MCP data, show structured info
	if (parsedData && typeof parsedData === "object") {
		if (parsedData.serverName || parsedData.toolName || parsedData.uri) {
			const serverName = parsedData.serverName
			const toolName = parsedData.toolName
			const uri = parsedData.uri
			const type = parsedData.type

			return (
				<div className={padding}>
					<div className="text-sm text-vscode-foreground leading-relaxed mb-2">
						{type === "use_mcp_tool" &&
							serverName &&
							toolName &&
							`Use tool "${toolName}" from ${serverName}`}
						{type === "access_mcp_resource" && serverName && uri && `Access resource from ${serverName}`}
						{!type && serverName && `MCP Server: ${serverName}`}
					</div>

					{toolName && (
						<div className="text-xs text-vscode-descriptionForeground mb-1">
							<span className="opacity-70">Tool:</span> {toolName}
						</div>
					)}

					{uri && (
						<div className="text-xs text-vscode-descriptionForeground font-mono">
							<span className="opacity-70">Resource:</span> {uri}
						</div>
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
