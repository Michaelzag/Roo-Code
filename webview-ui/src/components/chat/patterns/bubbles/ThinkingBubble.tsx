import React from "react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { ExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { AutoFormattedContent } from "./shared/ThemedComponents"

/**
 * ThinkingContent - Uses shared expandable content with enhanced formatting
 */
const ThinkingContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification, expanded = true, onToggleExpand }) => {
	const { t } = useTranslation()

	// Smart preview logic based on streaming state
	const getPreviewText = () => {
		const lines = (message.text || "").split("\n").filter((line) => line.trim())
		if (!lines.length) return ""

		if (message.partial) {
			return lines[lines.length - 1]?.trim() || ""
		} else {
			return lines[0]?.trim() || ""
		}
	}

	const previewText = getPreviewText()

	// Enhanced content rendering with semantic theming
	const renderThinkingContent = () => (
		<div className="space-y-2">
			{/* Thinking indicator */}
			<div className="flex items-center gap-2 mb-3">
				<span
					className="px-2 py-1 rounded-md text-xs font-semibold"
					style={{
						background: "var(--semantic-accent-color, var(--vscode-charts-yellow))20",
						color: "var(--semantic-text-accent, var(--vscode-foreground))",
						border: "1px solid var(--semantic-border-color, var(--vscode-panel-border))40",
					}}>
					💭 Reasoning Process
				</span>
			</div>

			{/* Formatted thinking content */}
			<AutoFormattedContent
				semantic="thinking"
				content={message.text || "Thinking..."}
				className="leading-relaxed"
			/>
		</div>
	)

	return (
		<ExpandableBubbleContent
			message={message}
			classification={classification}
			icon="lightbulb"
			title={t("chat:reasoning.thinking")}
			expanded={expanded}
			onToggleExpand={onToggleExpand}
			headerSubtitle={expanded ? undefined : previewText}
			renderContent={renderThinkingContent}
		/>
	)
}

/**
 * ThinkingBubble - Uses shared bubble factory with thinking semantic
 */
export const ThinkingBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"thinking",
	"yellow",
)(ThinkingContent)
