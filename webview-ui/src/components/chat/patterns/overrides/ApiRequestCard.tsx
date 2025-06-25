import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@src/lib/utils"
import { ProgressIndicator } from "../../ProgressIndicator"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineMessage } from "@roo-code/types"
import { DESIGN_SYSTEM } from "../../theme/chatDefaults"

interface ApiRequestCardProps {
	message: ClineMessage
	cost?: number
	cancelReason?: string
	streamingFailedMessage?: string
	apiRequestFailedMessage?: string
	isExpanded: boolean
	isLast: boolean
	onToggleExpand: () => void
	className?: string
}

/**
 * ApiRequestCard - Displays API request information with cost, timing, and expandable content
 */
export const ApiRequestCard: React.FC<ApiRequestCardProps> = ({
	message,
	cost,
	cancelReason,
	streamingFailedMessage,
	apiRequestFailedMessage,
	isExpanded,
	isLast: _isLast,
	onToggleExpand,
	className,
}) => {
	const { t: _t } = useTranslation()

	// State for error expansion - moved to top level to comply with Rules of Hooks
	const [errorExpanded, setErrorExpanded] = useState(false)

	// Determine status and appropriate icon/color
	const getStatusIcon = () => {
		if (cancelReason !== null && cancelReason !== undefined) {
			if (cancelReason === "user_cancelled") {
				return (
					<span className="codicon codicon-error" style={{ color: "var(--vscode-descriptionForeground)" }} />
				)
			} else {
				return <span className="codicon codicon-error" style={{ color: "var(--vscode-errorForeground)" }} />
			}
		} else if (cost !== null && cost !== undefined) {
			return <span className="codicon codicon-check" style={{ color: "var(--vscode-charts-green)" }} />
		} else if (apiRequestFailedMessage) {
			return <span className="codicon codicon-error" style={{ color: "var(--vscode-errorForeground)" }} />
		} else {
			return <ProgressIndicator />
		}
	}

	// Cost badge component
	const CostBadge = () => {
		if (cost !== null && cost !== undefined && cost > 0) {
			return (
				<div
					style={{
						background:
							"color-mix(in srgb, var(--vscode-charts-green) 25%, var(--vscode-editor-background))",
						border: "1px solid color-mix(in srgb, var(--vscode-charts-green) 50%, transparent)",
						borderRadius: "12px",
						padding: "4px 10px",
						color: "var(--vscode-charts-green)",
						fontWeight: "600",
						fontSize: "13px",
					}}>
					${Number(cost)?.toFixed(4)}
				</div>
			)
		}
		return null
	}

	// Error message component
	const ErrorMessage = () => {
		const errorText = apiRequestFailedMessage || streamingFailedMessage || jsonStreamingFailedMessage
		if (!errorText && !jsonCancelReason) return null

		return (
			<div
				className={`${DESIGN_SYSTEM.spacing.componentContentPadding} border border-vscode-errorForeground rounded`}
				style={{
					backgroundColor: "color-mix(in srgb, var(--vscode-errorForeground) 10%, transparent)",
				}}>
				<div
					className={`flex items-center gap-2 ${DESIGN_SYSTEM.spacing.componentContentPadding} cursor-pointer`}
					onClick={() => setErrorExpanded(!errorExpanded)}
					style={{ borderBottom: errorExpanded ? "1px solid var(--vscode-errorForeground)" : "none" }}>
					<span
						className="codicon codicon-warning"
						style={{ color: "var(--vscode-errorForeground)", fontSize: "14px" }}
					/>
					<span
						style={{
							color: "var(--vscode-errorForeground)",
							fontSize: "13px",
							fontWeight: "500",
							flex: 1,
						}}>
						API Request Failed
					</span>
					<span
						className={`codicon codicon-chevron-${errorExpanded ? "up" : "down"}`}
						style={{
							fontSize: "12px",
							color: "var(--vscode-errorForeground)",
							opacity: 0.8,
						}}
					/>
				</div>
				{errorExpanded && (
					<div
						className={DESIGN_SYSTEM.spacing.componentCodePadding}
						style={{
							fontFamily: "var(--vscode-editor-font-family)",
							fontSize: "11px",
							color: "var(--vscode-errorForeground)",
							whiteSpace: "pre-wrap",
							wordBreak: "break-word",
							maxHeight: "200px",
							overflowY: "auto",
						}}>
						{errorText || `Request ${jsonCancelReason || "failed"}`}
					</div>
				)}
			</div>
		)
	}

	// Expanded content component
	const ExpandedContent = () => {
		if (!isExpanded) return null

		const requestContent = safeJsonParse<any>(message.text)?.request || ""

		return (
			<div className={`mt-2 ${DESIGN_SYSTEM.spacing.componentContentPadding}`}>
				<div
					className={DESIGN_SYSTEM.spacing.componentCodePadding}
					style={{
						background: "var(--vscode-textCodeBlock-background)",
						border: "1px solid var(--vscode-panel-border)",
						borderRadius: "6px",
						fontFamily: "var(--vscode-editor-font-family)",
						fontSize: "13px",
						color: "var(--vscode-foreground)",
						whiteSpace: "pre-wrap",
						userSelect: "text",
						cursor: "text",
						maxHeight: "400px",
						overflowY: "auto",
					}}>
					{requestContent}
				</div>
			</div>
		)
	}

	// Extract time and context from the API request data
	const apiData = safeJsonParse<any>(message.text) || {}
	const requestText = apiData.request || ""

	// Check for error info in the JSON data as well
	const jsonCancelReason = apiData.cancelReason
	const jsonStreamingFailedMessage = apiData.streamingFailedMessage

	// Extract time and context from the request field which contains environment details
	const timeMatch = requestText.match(/# Current Time\s*\n([^\n(]+)/)
	const contextMatch = requestText.match(/# Current Context Size \(Tokens\)\s*\n([^\n]+)/)

	const currentTime = timeMatch?.[1]?.trim() || ""
	const rawContext = contextMatch?.[1]?.trim() || ""
	const currentContext = rawContext ? `Current Context Size: ${rawContext}` : ""

	return (
		<div
			className={cn(
				"border border-gray-600/20 rounded-md bg-vscode-input-background/50 shadow-sm overflow-hidden",
				DESIGN_SYSTEM.spacing.workMargin,
				className,
			)}>
			{/* Header bar with three-section layout */}
			<div
				className={`grid grid-cols-3 items-center gap-2 ${DESIGN_SYSTEM.spacing.componentContentPadding} cursor-pointer hover:bg-vscode-input-background/70 transition-colors`}
				onClick={onToggleExpand}>
				{/* Left: Status, title, and cost */}
				<div className="flex items-center gap-2">
					{getStatusIcon()}
					<span style={{ color: "var(--vscode-foreground)", fontWeight: "600", fontSize: "13px" }}>
						API Request
					</span>
					<CostBadge />
				</div>

				{/* Center: Context information */}
				<div className="text-center">
					{currentContext && (
						<div
							style={{
								color: "var(--vscode-foreground)",
								fontSize: "13px",
								fontWeight: "500",
							}}>
							{currentContext}
						</div>
					)}
				</div>

				{/* Right: Time and chevron */}
				<div className="flex items-center gap-2 justify-end">
					{currentTime && (
						<div
							style={{
								color: "var(--vscode-foreground)",
								fontSize: "13px",
								fontWeight: "500",
							}}>
							{currentTime}
						</div>
					)}
					<span
						className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
						style={{
							fontSize: "14px",
							color: "var(--vscode-foreground)",
							opacity: 0.8,
							transition: "transform 0.2s ease",
						}}
					/>
				</div>
			</div>

			{/* Error message if any */}
			<ErrorMessage />

			{/* Expanded content */}
			<ExpandedContent />
		</div>
	)
}
