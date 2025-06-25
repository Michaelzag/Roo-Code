import React from "react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/layouts/TimestampExpandableBubbleContent"
import { safeJsonParse } from "@roo/safeJsonParse"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { SmartContentRenderer } from "./shared/renderers/SmartContentRenderer"
import type { ExpandableBubbleProps, BubbleContentLimits } from "./types"
import { ScaledText, ScaledIcon } from "./shared/TypographyInheritance"

interface McpBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
}

// Define MCP request types locally since they're not exported properly
interface McpToolRequest {
	type: "use_mcp_tool"
	serverName: string
	toolName: string
	arguments?: any
	response?: string
}

interface McpResourceRequest {
	type: "access_mcp_resource"
	serverName: string
	uri: string
	response?: string
}

type McpRequest = McpToolRequest | McpResourceRequest

/**
 * McpContentRenderer - Handles both MCP requests and responses
 */
const McpContentRenderer: React.FC<{
	message: ClineMessage
	contentLimits?: BubbleContentLimits
}> = ({ message, contentLimits }) => {
	const { t } = useTranslation()
	const { mcpServers } = useExtensionState()

	// Quick check: must look like JSON before attempting to parse
	const text = message.text?.trim()
	const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

	// Parse the MCP server request from message text only if it looks like JSON
	const messageJson = isValidJson ? safeJsonParse<any>(message.text, {}) : {}
	const mcpRequest: McpRequest = messageJson

	// If parsing fails, show fallback content
	if (!mcpRequest || !mcpRequest.serverName) {
		return (
			<div className="space-y-2">
				<div className="text-sm font-medium text-vscode-foreground">MCP Server Operation</div>
				<div className="text-xs text-vscode-descriptionForeground">Processing MCP request...</div>
			</div>
		)
	}

	const server = mcpServers.find((s) => s.name === mcpRequest.serverName)

	return (
		<div className="space-y-4">
			{/* Tool Call Section */}
			<div className="bg-vscode-input-background/30 border border-vscode-panel-border rounded-lg p-4 space-y-3">
				{/* Section Header */}
				<div className="flex items-center gap-2 pb-2 border-b border-vscode-panel-border/50">
					<ScaledIcon
						className="codicon codicon-terminal"
						style={{ color: "var(--semantic-primary-color, #8b5cf6)" }}
					/>
					<ScaledText context="emphasis" className="text-vscode-foreground">
						{mcpRequest.type === "use_mcp_tool" ? "Tool Call" : "Resource Access"}
					</ScaledText>
				</div>

				{/* Main operation description */}
				<div className="flex items-center gap-2">
					<span className="codicon codicon-server text-sm text-vscode-foreground" />
					<div className="text-sm font-medium text-vscode-foreground">
						{mcpRequest.type === "use_mcp_tool"
							? t("chat:mcp.wantsToUseTool", { serverName: mcpRequest.serverName })
							: t("chat:mcp.wantsToAccessResource", { serverName: mcpRequest.serverName })}
					</div>
				</div>

				{/* Server info */}
				<div className="pl-6 space-y-2">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-server-process text-xs text-vscode-descriptionForeground" />
						<span className="text-sm font-mono text-vscode-foreground">{mcpRequest.serverName}</span>
						{server && (
							<span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
								Connected
							</span>
						)}
					</div>

					{/* Tool/Resource specific details */}
					{mcpRequest.type === "use_mcp_tool" && mcpRequest.toolName && (
						<div className="flex items-center gap-2">
							<span className="codicon codicon-tools text-xs text-vscode-descriptionForeground" />
							<span className="text-sm font-mono font-semibold text-vscode-foreground">
								{mcpRequest.toolName}
							</span>
						</div>
					)}

					{mcpRequest.type === "access_mcp_resource" && mcpRequest.uri && (
						<div className="flex items-center gap-2">
							<span className="codicon codicon-link text-xs text-vscode-descriptionForeground" />
							<span className="text-sm font-mono font-semibold text-vscode-foreground break-all">
								{mcpRequest.uri}
							</span>
						</div>
					)}

					{/* Show arguments if present */}
					{mcpRequest.type === "use_mcp_tool" && mcpRequest.arguments && (
						<div className="space-y-2 mt-3">
							<div className="text-xs text-vscode-descriptionForeground font-medium">Arguments:</div>
							<div className="bg-vscode-textCodeBlock-background border border-vscode-panel-border rounded-md p-3 text-xs font-mono overflow-x-auto">
								<pre className="whitespace-pre-wrap text-vscode-foreground">
									{typeof mcpRequest.arguments === "string"
										? mcpRequest.arguments
										: JSON.stringify(mcpRequest.arguments, null, 2)}
								</pre>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* MCP Response/Results Section */}
			{mcpRequest.response && (
				<div className="bg-vscode-textCodeBlock-background/50 border border-vscode-panel-border rounded-lg p-4 space-y-3">
					{/* Response Header */}
					<div className="flex items-center gap-2 pb-2 border-b border-vscode-panel-border/50">
						<span
							className="codicon codicon-output text-sm"
							style={{ color: "var(--semantic-primary-color, #8b5cf6)" }}
						/>
						<div className="text-sm font-semibold text-vscode-foreground">Response</div>
						<div className="ml-auto">
							<span className="px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 border border-green-500/30">
								Success
							</span>
						</div>
					</div>

					{/* Response Content */}
					<div className="bg-vscode-editor-background border border-vscode-widget-border rounded-md p-3">
						<SmartContentRenderer
							message={{ ...message, text: mcpRequest.response }}
							semantic="mcp"
							contentLimits={contentLimits}
						/>
					</div>
				</div>
			)}

			{/* Show status if no response yet */}
			{!mcpRequest.response && (
				<div className="bg-vscode-input-background/20 border border-dashed border-vscode-panel-border rounded-lg p-4">
					<div className="flex items-center justify-center gap-2 text-vscode-descriptionForeground">
						<span className="codicon codicon-loading codicon-modifier-spin text-sm" />
						<span className="text-sm">Waiting for response...</span>
					</div>
				</div>
			)}
		</div>
	)
}

/**
 * McpContent - Uses shared timestamp-based expandable content with internal state management
 */
const McpContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	contentLimits?: BubbleContentLimits
}> = ({ message, classification, contentLimits }) => {
	// Use internal expansion state to respect collapsedByDefault: false
	// Don't pass isExpanded or onToggleExpand to let component manage its own state
	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="extensions"
			title="MCP Operation"
			contentLimits={contentLimits}
			renderContent={(msg, limits) => <McpContentRenderer message={msg} contentLimits={limits} />}
		/>
	)
}

/**
 * McpBubble - Uses shared bubble factory with mcp semantic and proper content limits
 */
export const McpBubble: React.FC<McpBubbleProps> = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
}>("mcp", "purple", {
	maxLines: 100, // Allow longer MCP responses
	collapsedByDefault: false, // Always expanded by default to show MCP results
	previewLines: 15, // Show more preview when collapsed
})(McpContent)
