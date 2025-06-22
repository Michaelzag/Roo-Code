import React from "react"
import { useTranslation } from "react-i18next"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { OverrideBubble } from "../BubbleUnified"
import { Markdown } from "../../Markdown"

interface FollowUpCardProps {
	message: ClineMessage
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

/**
 * FollowUpCard - Beautiful followup question component
 *
 * Recreates the destroyed followup question UI with:
 * - Blue info-themed styling
 * - Question text with proper typography
 * - Selectable suggestion buttons
 * - Clean, professional layout
 */
export const FollowUpCard: React.FC<FollowUpCardProps> = ({ message, onSuggestionClick }) => {
	const { t } = useTranslation()

	// Parse followup data
	const followUpData = safeJsonParse<any>(message.text)
	const question = followUpData?.question || message.text
	const suggestions = followUpData?.suggest || []

	// Completion semantic classification (followup questions use completion semantic)
	const classification: MessageStyle = {
		type: "standard",
		pattern: "bubble",
		semantic: "completion",
		color: "green", // completion color from SEMANTIC_COLOR_MAP
		variant: "work",
	}

	const handleSuggestionClick = (suggestion: string, event: React.MouseEvent) => {
		event.preventDefault()
		onSuggestionClick?.(suggestion, event)
	}

	const header = (
		<div className="flex items-center py-3 px-4 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800/50">
			<span className="codicon codicon-info mr-3 text-blue-600 dark:text-blue-400" style={{ fontSize: "16px" }} />
			<span className="text-blue-700 dark:text-blue-300 font-medium text-sm">
				{t("chat:questions.hasQuestion")}
			</span>
		</div>
	)

	return (
		<OverrideBubble
			message={message}
			classification={classification}
			header={header}
			className="border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20">
			{/* Question Content */}
			<div className="p-4">
				<div className="text-vscode-foreground text-[14px] leading-relaxed mb-4">
					<Markdown markdown={question} />
				</div>

				{/* Suggestion Buttons */}
				{suggestions.length > 0 && (
					<div className="space-y-2">
						{suggestions.map((suggestion: string, index: number) => (
							<button
								key={index}
								onClick={(e) => handleSuggestionClick(suggestion, e)}
								className="w-full text-left p-3 rounded-lg border border-blue-200 dark:border-blue-700 
                          bg-white dark:bg-vscode-editor-background
                          hover:bg-blue-50 dark:hover:bg-blue-900/20 
                          hover:border-blue-300 dark:hover:border-blue-600
                          transition-all duration-150 ease-in-out
                          text-[13px] text-vscode-foreground
                          focus:outline-none focus:ring-2 focus:ring-blue-500/50">
								<div className="flex items-start">
									<span className="codicon codicon-circle-small mr-2 mt-0.5 text-blue-500 dark:text-blue-400 opacity-70" />
									<span>{suggestion}</span>
								</div>
							</button>
						))}
					</div>
				)}
			</div>
		</OverrideBubble>
	)
}
