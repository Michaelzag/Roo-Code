import { useCallback } from "react"
import { Edit } from "lucide-react"

import { Button } from "@/components/ui"

import { useAppTranslation } from "@src/i18n/TranslationContext"

interface FollowUpSuggestProps {
	suggestions?: string[]
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
	ts: number
}

export const FollowUpSuggest = ({ suggestions = [], onSuggestionClick, ts = 1 }: FollowUpSuggestProps) => {
	const { t } = useAppTranslation()
	const handleSuggestionClick = useCallback(
		(suggestion: string, event: React.MouseEvent) => {
			onSuggestionClick?.(suggestion, event)
		},
		[onSuggestionClick],
	)

	// Don't render if there are no suggestions or no click handler.
	if (!suggestions?.length || !onSuggestionClick) {
		return null
	}

	return (
		<div className="flex flex-col h-full gap-1.5">
			{suggestions.map((suggestion) => (
				<div key={`${suggestion}-${ts}`} className="w-full relative group">
					<Button
						variant="outline"
						className="text-left whitespace-normal break-words w-full h-auto py-2.5 px-3 justify-start pr-5 rounded-md font-medium"
						style={{
							color: "var(--vscode-foreground)",
							borderColor:
								"color-mix(in srgb, var(--vscode-activityBarBadge-background) 25%, var(--vscode-widget-border))",
							backgroundColor:
								"color-mix(in srgb, var(--vscode-editor-background) 85%, var(--vscode-activityBarBadge-background) 5%)",
							transition: "all 0.2s ease",
							fontSize: "13px",
							lineHeight: "1.4",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = "translateY(-1px)"
							e.currentTarget.style.borderColor =
								"color-mix(in srgb, var(--vscode-activityBarBadge-background) 40%, var(--vscode-focusBorder))"
							e.currentTarget.style.backgroundColor =
								"color-mix(in srgb, var(--vscode-editor-background) 80%, var(--vscode-activityBarBadge-background) 10%)"
							e.currentTarget.style.boxShadow =
								"0 2px 8px color-mix(in srgb, var(--vscode-widget-shadow) 12%, transparent)"
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = "translateY(0)"
							e.currentTarget.style.borderColor =
								"color-mix(in srgb, var(--vscode-activityBarBadge-background) 25%, var(--vscode-widget-border))"
							e.currentTarget.style.backgroundColor =
								"color-mix(in srgb, var(--vscode-editor-background) 85%, var(--vscode-activityBarBadge-background) 5%)"
							e.currentTarget.style.boxShadow = "none"
						}}
						onClick={(event) => handleSuggestionClick(suggestion, event)}
						aria-label={suggestion}>
						<div className="leading-relaxed flex items-start gap-2">
							<div className="flex-shrink-0 w-1 h-1 rounded-full bg-[color-mix(in_srgb,var(--vscode-activityBarBadge-background)_50%,transparent)] mt-1"></div>
							<div className="flex-1">{suggestion}</div>
						</div>
					</Button>
					<div
						className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
						onClick={(e) => {
							e.stopPropagation()
							// Simulate shift-click by directly calling the handler with shiftKey=true.
							onSuggestionClick?.(suggestion, { ...e, shiftKey: true })
						}}
						title={t("chat:followUpSuggest.copyToInput")}>
						<Button variant="ghost" size="icon">
							<Edit />
						</Button>
					</div>
				</div>
			))}
		</div>
	)
}
