import React from "react"
import { useTranslation } from "react-i18next"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { Markdown } from "../../Markdown"

interface CompletionBubbleProps {
	message: ClineMessage
	classification?: MessageStyle
	children?: React.ReactNode
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
	className?: string
}

/**
 * CompletionContent - Content component for followup questions with suggestions
 * Uses shared SimpleBubbleContent with custom content rendering
 */
const CompletionContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}> = ({ message, onSuggestionClick }) => {
	const { t } = useTranslation()

	// Parse followup data
	const followUpData = safeJsonParse<any>(message.text)
	const question = followUpData?.question || message.text
	const suggestions = followUpData?.suggest || []

	const handleSuggestionClick = (suggestion: string, event: React.MouseEvent) => {
		event.preventDefault()
		onSuggestionClick?.(suggestion, event)
	}

	const renderCustomContent = () => (
		<>
			{/* Question Text */}
			<div className={`text-sm text-vscode-foreground leading-relaxed ${suggestions.length > 0 ? "mb-4" : ""}`}>
				<Markdown markdown={question} />
			</div>

			{/* Suggestion Buttons */}
			{suggestions.length > 0 && (
				<div className="space-y-2">
					{suggestions.map((suggestion: string, index: number) => (
						<button
							key={index}
							onClick={(e) => handleSuggestionClick(suggestion, e)}
							className="w-full text-left p-3 rounded border border-vscode-panel-border
                        bg-vscode-input-background/50 text-sm text-vscode-foreground
                        hover:bg-vscode-input-background/70 hover:border-vscode-focusBorder/50
                        focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder/50
                        transition-all duration-150">
							<div className="flex items-start">
								<span className="codicon codicon-circle-small mr-2 mt-0.5 text-xs opacity-70" />
								<span>{suggestion}</span>
							</div>
						</button>
					))}
				</div>
			)}
		</>
	)

	return (
		<SimpleBubbleContent
			message={message}
			classification={{} as MessageStyle} // Will be set by BubbleUnified
			icon="info"
			title={t("chat:questions.hasQuestion")}
			renderContent={renderCustomContent}
		/>
	)
}

/**
 * CompletionBubble - Uses shared bubble factory with completion semantic
 */
export const CompletionBubble: React.FC<CompletionBubbleProps> = createBubbleComponent<{
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}>(
	"completion",
	"green",
)(CompletionContent)
