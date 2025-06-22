import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { safeJsonParse } from "@roo/safeJsonParse"

/**
 * ModeChangeContent - Uses shared simple content with proper JSON formatting
 */
const ModeChangeContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
}> = ({ message, classification }) => {
	// Parse the JSON tool data to extract mode change information
	const toolData = safeJsonParse(message.text) as any
	const mode = toolData?.mode || "unknown mode"
	const reason = toolData?.reason || "No reason provided"

	// Create formatted content instead of raw JSON
	const formatModeChangeContent = () => (
		<div className="space-y-2">
			<div className="flex items-center gap-2">
				<span className="font-medium text-sm">Switching to:</span>
				<span
					className="px-2 py-1 rounded-md text-xs font-semibold"
					style={{
						background: "var(--semantic-accent-color, var(--vscode-charts-purple))20",
						color: "var(--semantic-text-accent, var(--vscode-foreground))",
					}}>
					{mode}
				</span>
			</div>
			{reason && (
				<div className="text-sm opacity-90 leading-relaxed">
					<span className="font-medium">Reason:</span> {reason}
				</div>
			)}
		</div>
	)

	return (
		<SimpleBubbleContent
			message={message}
			classification={classification}
			icon="arrow-swap"
			title="Mode Switch"
			renderContent={formatModeChangeContent}
		/>
	)
}

/**
 * ModeChangeBubble - Uses shared bubble factory with mode-change semantic
 */
export const ModeChangeBubble = createBubbleComponent("mode-change", "purple")(ModeChangeContent)
