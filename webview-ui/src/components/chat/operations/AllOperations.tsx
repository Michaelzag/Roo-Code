import React, { useState, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { safeJsonParse } from "@roo/safeJsonParse"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { WorkBubble } from "../patterns/BubbleUnified"
import { ThinkingBubble } from "../patterns/bubbles/ThinkingBubble"
import { OverrideHeader } from "../shared/OverrideHeader"
import { ProgressIndicator } from "../ProgressIndicator"
import { CommandExecution } from "../CommandExecution"
import { FollowUpSuggest } from "../FollowUpSuggest"
import { Markdown } from "../Markdown"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../theme/chatDefaults"
import type { ClineAskUseMcpServer } from "@roo/ExtensionMessage"

interface AllOperationsProps {
	message: ClineMessage
	classification: MessageStyle
	lastModifiedMessage?: ClineMessage
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	onToggleExpand: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

/**
 * AllOperations - Handles remaining operations from WorkCard
 *
 * Covers: command execution, MCP operations, follow-up questions,
 * error handling, and reasoning display. Extracted to complete
 * the WorkCard breakdown while preserving all functionality.
 */
export const AllOperations: React.FC<AllOperationsProps> = ({
	message,
	classification,
	lastModifiedMessage,
	isExpanded,
	isLast,
	isStreaming: _isStreaming,
	onToggleExpand,
	onSuggestionClick,
}) => {
	const { t } = useTranslation()
	const { mcpServers, alwaysAllowMcp: _alwaysAllowMcp } = useExtensionState()

	// State for reasoning expansion - moved to top level to comply with Rules of Hooks
	const [reasoningExpanded, setReasoningExpanded] = useState(true)

	// Memoized callback to prevent re-renders
	const handleToggleExpand = useCallback(() => {
		onToggleExpand(message.ts)
	}, [onToggleExpand, message.ts])

	const isCommandExecuting =
		isLast && lastModifiedMessage?.ask === "command" && lastModifiedMessage?.text?.includes("COMMAND_OUTPUT_STRING")

	const followUpData = useMemo(() => {
		if (message.type === "ask" && message.ask === "followup" && !message.partial) {
			return safeJsonParse<any>(message.text)
		}
		return null
	}, [message.type, message.ask, message.partial, message.text])

	// Helper function for operation headers
	const createOperationHeader = (iconClass: string, title: string) => (
		<OverrideHeader
			icon={iconClass}
			title={title}
			onClick={handleToggleExpand}
			isExpanded={isExpanded}
			iconColor={classification.color ? `var(--vscode-${classification.color}-500)` : "var(--vscode-foreground)"}
		/>
	)

	// Handle ask type operations
	if (message.type === "ask") {
		switch (message.ask) {
			case "command":
				return (
					<WorkBubble message={message} classification={classification}>
						{createOperationHeader(isCommandExecuting ? "loading" : "terminal", t("chat:runCommand.title"))}
						<div className="px-4 pb-3 pt-0">
							<CommandExecution
								executionId={message.ts.toString()}
								text={message.text}
								icon={isCommandExecuting ? <ProgressIndicator /> : null}
								title={null}
							/>
						</div>
					</WorkBubble>
				)

			case "use_mcp_server": {
				const messageJson = safeJsonParse<any>(message.text, {})
				const { response, ...mcpServerRequest } = messageJson
				const useMcpServer: ClineAskUseMcpServer = { ...mcpServerRequest, response }

				// If parsing fails, show simple content instead of raw JSON
				if (!useMcpServer || !useMcpServer.serverName) {
					return (
						<div
							style={{
								fontSize: "14px",
								color: "var(--vscode-foreground)",
								paddingLeft: "4px",
							}}>
							MCP Server Operation
						</div>
					)
				}

				const _server = mcpServers.find((server) => server.name === useMcpServer.serverName)

				// Compact MCP display like file operations
				return (
					<div>
						{/* Simple header text like file operations */}
						<div
							style={{
								fontSize: "14px",
								color: "var(--vscode-foreground)",
								marginBottom: "4px",
								paddingLeft: "4px",
							}}>
							{useMcpServer.type === "use_mcp_tool"
								? t("chat:mcp.wantsToUseTool", { serverName: useMcpServer.serverName })
								: t("chat:mcp.wantsToAccessResource", { serverName: useMcpServer.serverName })}
						</div>

						{/* Tool/Resource details - compact */}
						{useMcpServer.toolName && (
							<div
								style={{
									paddingLeft: "16px",
									fontSize: "13px",
									display: "flex",
									alignItems: "center",
								}}>
								<span
									className="codicon codicon-tools"
									style={{ marginRight: "6px", fontSize: "12px", opacity: 0.7 }}
								/>
								<span style={{ fontFamily: "var(--vscode-editor-font-family)" }}>
									{useMcpServer.toolName}
								</span>
							</div>
						)}

						{useMcpServer.uri && (
							<div
								style={{
									paddingLeft: "16px",
									fontSize: "13px",
									display: "flex",
									alignItems: "center",
								}}>
								<span
									className="codicon codicon-link"
									style={{ marginRight: "6px", fontSize: "12px", opacity: 0.7 }}
								/>
								<span style={{ fontFamily: "var(--vscode-editor-font-family)" }}>
									{useMcpServer.uri}
								</span>
							</div>
						)}
					</div>
				)
			}

			case "followup":
				return (
					<WorkBubble message={message} classification={classification}>
						{createOperationHeader("question", t("chat:questions.hasQuestion"))}
						<div className="px-4 pb-3 pt-0">
							<div
								style={{
									paddingBottom: 8,
									color: "var(--vscode-foreground)",
									fontSize: "14px",
									lineHeight: "1.5",
								}}>
								<Markdown
									markdown={message.partial === true ? message?.text : followUpData?.question}
								/>
							</div>
							<FollowUpSuggest
								suggestions={followUpData?.suggest}
								onSuggestionClick={onSuggestionClick}
								ts={message?.ts}
							/>
						</div>
					</WorkBubble>
				)

			default:
				return null
		}
	}

	// Handle say type operations
	if (message.type === "say") {
		switch (message.say) {
			case "reasoning": {
				return (
					<ThinkingBubble
						message={message}
						classification={classification}
						expanded={reasoningExpanded}
						onToggleExpand={() => setReasoningExpanded(!reasoningExpanded)}
					/>
				)
			}

			default:
				return (
					<WorkBubble message={message} classification={classification}>
						<div
							style={{
								color: "var(--vscode-foreground)",
								fontSize: "14px",
								lineHeight: "1.6",
							}}>
							<Markdown markdown={message.text} partial={message.partial} />
						</div>
					</WorkBubble>
				)
		}
	}

	return null
}
