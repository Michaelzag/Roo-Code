import React, { useContext } from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { safeJsonParse } from "@roo/safeJsonParse"
import { getAllModes } from "@roo/modes"
import { ExtensionStateContext } from "../../../../context/ExtensionStateContext"

/**
 * Get the pretty display name for a mode slug using dynamic mode data
 */
const getModeDisplayName = (slug: string, customModes?: any[]): string => {
	const allModes = getAllModes(customModes)
	const mode = allModes.find((m) => m.slug === slug)
	return mode?.name || slug
}

/**
 * ModeChangeContent - Uses shared simple content with proper JSON formatting
 */
const ModeChangeContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
}> = ({ message, classification }) => {
	const extensionState = useContext(ExtensionStateContext)

	// Quick check: must look like JSON before attempting to parse
	const text = message.text?.trim()
	const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

	// Parse the JSON tool data to extract mode change information
	const toolData = isValidJson ? (safeJsonParse(message.text) as any) : {}
	const modeSlug = toolData?.mode || "unknown mode"
	const mode = getModeDisplayName(modeSlug, extensionState?.customModes)
	const reason = toolData?.reason || "No reason provided"

	// Create formatted content instead of raw JSON
	const formatModeChangeContent = () => (
		<div className="space-y-1">
			<div className="flex items-center gap-2">
				<span className="chat-standard-typography">Switching to:</span>
				<span
					className="px-2 py-0.5 rounded-md chat-badge-typography"
					style={{
						background: "var(--semantic-accent-color, var(--vscode-charts-purple))20",
						color: "var(--semantic-text-accent, var(--vscode-foreground))",
					}}>
					{mode}
				</span>
			</div>
			{reason && (
				<div className="chat-content-typography opacity-90">
					<span className="chat-standard-typography">Reason:</span> {reason}
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
