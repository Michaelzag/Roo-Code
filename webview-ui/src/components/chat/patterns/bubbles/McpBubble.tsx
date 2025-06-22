import React from "react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineAskUseMcpServer } from "@roo/ExtensionMessage"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * McpContent - Uses shared simple content with proper JSON parsing
 */
const McpContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification }) => {
	const { t } = useTranslation()
	const { mcpServers } = useExtensionState()

	// Parse the MCP server request from message text
	const messageJson = safeJsonParse<any>(message.text, {})
	const { response, ...mcpServerRequest } = messageJson
	const useMcpServer: ClineAskUseMcpServer = { ...mcpServerRequest, response }

	// Create formatted content following the established pattern
	const formatMcpContent = () => {
		// If parsing fails, show fallback content
		if (!useMcpServer || !useMcpServer.serverName) {
			return (
				<div className="space-y-2">
					<div className="text-sm font-medium">MCP Server Operation</div>
					<div className="text-xs opacity-70">Processing MCP request...</div>
				</div>
			)
		}

		const _server = mcpServers.find((server) => server.name === useMcpServer.serverName)

		return (
			<div className="space-y-3">
				{/* Main operation description */}
				<div className="text-sm font-medium">
					{useMcpServer.type === "use_mcp_tool"
						? t("chat:mcp.wantsToUseTool", { serverName: useMcpServer.serverName })
						: t("chat:mcp.wantsToAccessResource", { serverName: useMcpServer.serverName })}
				</div>

				{/* Tool/Resource details */}
				<div className="space-y-2 pl-3">
					{useMcpServer.toolName && (
						<div className="flex items-center gap-2">
							<span className="codicon codicon-tools text-xs opacity-70" />
							<span className="text-sm font-mono">{useMcpServer.toolName}</span>
						</div>
					)}

					{useMcpServer.uri && (
						<div className="flex items-center gap-2">
							<span className="codicon codicon-link text-xs opacity-70" />
							<span className="text-sm font-mono">{useMcpServer.uri}</span>
						</div>
					)}

					{/* Show arguments if present */}
					{useMcpServer.arguments && (
						<div className="space-y-1">
							<div className="text-xs opacity-70 font-medium">Arguments:</div>
							<div className="bg-vscode-textCodeBlock-background border border-vscode-panel-border rounded p-2 text-xs font-mono max-h-32 overflow-auto">
								<pre className="whitespace-pre-wrap">
									{typeof useMcpServer.arguments === "string"
										? useMcpServer.arguments
										: JSON.stringify(useMcpServer.arguments, null, 2)}
								</pre>
							</div>
						</div>
					)}
				</div>
			</div>
		)
	}

	return (
		<SimpleBubbleContent
			message={message}
			classification={classification}
			icon="extensions"
			title="MCP Operation"
			renderContent={formatMcpContent}
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
