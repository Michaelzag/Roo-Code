import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { safeJsonParse } from "@roo/safeJsonParse"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * ApiContent - Uses shared simple content with proper JSON parsing
 */
const ApiContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification }) => {
	// Parse API request data from message text
	const apiData = safeJsonParse<any>(message.text, {})

	// Create formatted content following the established pattern
	const formatApiContent = () => {
		// Extract meaningful API information if available
		const request = apiData?.request || message.text
		const tokensIn = apiData?.tokensIn
		const tokensOut = apiData?.tokensOut
		const cost = apiData?.cost
		const cancelReason = apiData?.cancelReason

		return (
			<div className="space-y-3">
				{/* API Status */}
				{cancelReason && (
					<div className="flex items-center gap-2">
						<span className="codicon codicon-warning text-xs opacity-70" />
						<span className="text-sm font-medium text-orange-400">
							{cancelReason === "user_cancelled" ? "Cancelled by user" : "Request failed"}
						</span>
					</div>
				)}

				{/* Token usage if available */}
				{(tokensIn || tokensOut || cost) && (
					<div className="space-y-1">
						<div className="text-xs opacity-70 font-medium">Usage:</div>
						<div className="flex flex-wrap gap-3 text-xs">
							{tokensIn && (
								<span className="flex items-center gap-1">
									<span className="codicon codicon-arrow-down text-xs opacity-70" />
									{tokensIn.toLocaleString()} in
								</span>
							)}
							{tokensOut && (
								<span className="flex items-center gap-1">
									<span className="codicon codicon-arrow-up text-xs opacity-70" />
									{tokensOut.toLocaleString()} out
								</span>
							)}
							{cost && (
								<span className="flex items-center gap-1">
									<span className="codicon codicon-symbol-currency text-xs opacity-70" />$
									{cost.toFixed(4)}
								</span>
							)}
						</div>
					</div>
				)}

				{/* Request details */}
				{request && request !== message.text && (
					<div className="space-y-1">
						<div className="text-xs opacity-70 font-medium">Request:</div>
						<div className="bg-vscode-textCodeBlock-background border border-vscode-panel-border rounded p-2 text-xs max-h-32 overflow-auto">
							{typeof request === "string" ? request : JSON.stringify(request, null, 2)}
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
