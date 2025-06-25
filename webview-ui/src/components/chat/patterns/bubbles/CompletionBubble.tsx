import React from "react"
import { useTranslation } from "react-i18next"
import { safeJsonParse } from "@roo/safeJsonParse"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { Markdown } from "../../Markdown"
import { TypographyText } from "./shared/TypographyContext"

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
	const { t: _t } = useTranslation()

	// Quick check: must look like JSON before attempting to parse
	const text = message.text?.trim()
	const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

	// Parse followup data only if it looks like JSON
	const followUpData = isValidJson ? safeJsonParse<any>(message.text) : null
	const question = followUpData?.question || message.text
	const suggestions = followUpData?.suggest || []

	const handleSuggestionClick = (suggestion: string, event: React.MouseEvent) => {
		event.preventDefault()
		onSuggestionClick?.(suggestion, event)
	}

	const renderCustomContent = () => (
		<div className="space-y-5">
			{/* Star: The Question - HUGE and prominent */}
			<div className="p-1 mb-4">
				<div
					className="text-vscode-foreground font-bold leading-tight question-large"
					style={{
						fontSize: "1.5rem !important",
						["--vscode-font-size" as any]: "1.5rem",
					}}>
					<style>{`
						.question-large * {
							font-size: 1.5rem !important;
						}
					`}</style>
					<Markdown markdown={question} />
				</div>
			</div>

			{/* Star: The Answer Options - Compact and focused */}
			{suggestions.length > 0 && (
				<div className="space-y-2">
					{suggestions.map((suggestion: string, index: number) => (
						<button
							key={index}
							onClick={(e) => handleSuggestionClick(suggestion, e)}
							className="group w-full text-left py-3 px-3 rounded-lg border-2
							           hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-vscode-focusBorder/50
							           transition-all duration-300 relative transform hover:scale-105 hover:-translate-y-1"
							style={{
								background:
									"color-mix(in srgb, var(--semantic-primary-color) 8%, var(--vscode-editor-background))",
								borderColor:
									"color-mix(in srgb, var(--semantic-primary-color) 40%, var(--vscode-panel-border))",
								boxShadow:
									"0 2px 6px color-mix(in srgb, var(--semantic-primary-color) 10%, transparent)",
							}}
							onMouseEnter={(e) => {
								e.currentTarget.style.background =
									"color-mix(in srgb, var(--semantic-primary-color) 18%, var(--vscode-editor-background))"
								e.currentTarget.style.borderColor = "var(--semantic-primary-color)"
								e.currentTarget.style.boxShadow =
									"0 8px 25px color-mix(in srgb, var(--semantic-primary-color) 30%, transparent)"
							}}
							onMouseLeave={(e) => {
								e.currentTarget.style.background =
									"color-mix(in srgb, var(--semantic-primary-color) 8%, var(--vscode-editor-background))"
								e.currentTarget.style.borderColor =
									"color-mix(in srgb, var(--semantic-primary-color) 40%, var(--vscode-panel-border))"
								e.currentTarget.style.boxShadow =
									"0 2px 6px color-mix(in srgb, var(--semantic-primary-color) 10%, transparent)"
							}}>
							{/* Enhanced accent line with glow effect */}
							<div
								className="absolute left-0 top-0 bottom-0 w-1 group-hover:w-2 transition-all duration-300 group-hover:shadow-lg"
								style={{
									background: "var(--semantic-primary-color)",
									boxShadow: "0 0 0 transparent",
								}}
							/>

							{/* Hover glow effect overlay */}
							<div
								className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
								style={{
									background:
										"linear-gradient(135deg, color-mix(in srgb, var(--semantic-primary-color) 15%, transparent) 0%, color-mix(in srgb, var(--semantic-primary-color) 5%, transparent) 50%, transparent 100%)",
								}}
							/>

							<div className="flex items-center gap-2 ml-2 relative z-10">
								<div className="flex-shrink-0">
									<span
										className="codicon codicon-arrow-right text-xs opacity-70 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110"
										style={{ color: "var(--semantic-primary-color)" }}
									/>
								</div>
								<div className="flex-1">
									<TypographyText
										context="content"
										weight="medium"
										className="text-base leading-relaxed text-vscode-foreground group-hover:font-semibold transition-all duration-300">
										{suggestion}
									</TypographyText>
								</div>
								<div className="flex-shrink-0">
									<span
										className="codicon codicon-chevron-right text-xs opacity-30 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110 group-hover:translate-x-1"
										style={{ color: "var(--semantic-primary-color)" }}
									/>
								</div>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	)

	return (
		<SimpleBubbleContent
			message={message}
			classification={{ semantic: "completion" } as MessageStyle} // Ensure completion theme is applied
			icon="question"
			title="Roo has a question"
			renderContent={renderCustomContent}
		/>
	)
}

/**
 * CompletionBubble - Uses shared bubble factory with completion semantic
 * Enhanced with proper theming, typography, and visual hierarchy
 */
export const CompletionBubble: React.FC<CompletionBubbleProps> = createBubbleComponent<{
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}>("completion", "yellow", {
	maxLines: 25,
	collapsedByDefault: false,
	previewLines: 5,
})(CompletionContent)
