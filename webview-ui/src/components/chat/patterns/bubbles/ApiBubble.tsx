import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { safeJsonParse } from "@roo/safeJsonParse"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { DESIGN_SYSTEM } from "../../theme/chatDefaults"
import { TypographyText, MetadataText, CodeText } from "./shared/TypographyContext"

/**
 * ApiContent - Uses shared simple content with proper JSON parsing
 */
const ApiContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification }) => {
	// Quick check: must look like JSON before attempting to parse
	const text = message.text?.trim()
	const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

	// Parse API request data from message text only if it looks like JSON
	const apiData = isValidJson ? safeJsonParse<any>(message.text, {}) : {}

	// Create formatted content following the established pattern
	const formatApiContent = () => {
		// If not valid JSON, show plain text
		if (!isValidJson) {
			return <div className="text-sm text-vscode-foreground">{message.text || "No API data"}</div>
		}
		// Extract meaningful API information if available
		const request = apiData?.request || message.text
		const tokensIn = apiData?.tokensIn
		const tokensOut = apiData?.tokensOut
		const cost = apiData?.cost
		const cancelReason = apiData?.cancelReason

		return (
			<div className={DESIGN_SYSTEM.spacing.componentSectionGap}>
				{/* API Status */}
				{cancelReason && (
					<div className="flex items-center gap-2">
						<span className="codicon codicon-warning text-xs opacity-70" />
						<TypographyText context="emphasis" className="text-orange-400">
							{cancelReason === "user_cancelled" ? "Cancelled by user" : "Request failed"}
						</TypographyText>
					</div>
				)}

				{/* Token usage if available */}
				{(tokensIn || tokensOut || cost) && (
					<div className="space-y-1">
						<TypographyText context="metadata" weight="medium">
							Usage:
						</TypographyText>
						<div className="flex flex-wrap gap-3">
							{tokensIn && (
								<MetadataText className="flex items-center gap-1">
									<span className="codicon codicon-arrow-down text-xs opacity-70" />
									{tokensIn.toLocaleString()} in
								</MetadataText>
							)}
							{tokensOut && (
								<MetadataText className="flex items-center gap-1">
									<span className="codicon codicon-arrow-up text-xs opacity-70" />
									{tokensOut.toLocaleString()} out
								</MetadataText>
							)}
							{cost && (
								<MetadataText className="flex items-center gap-1">
									<span className="codicon codicon-symbol-currency text-xs opacity-70" />$
									{cost.toFixed(4)}
								</MetadataText>
							)}
						</div>
					</div>
				)}

				{/* Request details */}
				{request && request !== message.text && (
					<div className="space-y-1">
						<TypographyText context="metadata" weight="medium">
							Request:
						</TypographyText>
						<CodeText className="max-h-32 overflow-auto border border-vscode-panel-border rounded">
							{typeof request === "string" ? request : JSON.stringify(request, null, 2)}
						</CodeText>
					</div>
				)}
			</div>
		)
	}

	return (
		<SimpleBubbleContent
			message={message}
			classification={classification}
			icon="cloud"
			title="API Request"
			renderContent={formatApiContent}
		/>
	)
}

/**
 * ApiBubble - Uses shared bubble factory with api semantic
 */
export const ApiBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"api",
	"orange",
)(ApiContent)
