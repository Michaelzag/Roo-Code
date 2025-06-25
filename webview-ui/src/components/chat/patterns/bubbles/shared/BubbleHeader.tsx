import React from "react"
import type { MessageStyle } from "../../../theme/chatDefaults"
import { getSemanticTheme } from "../../../theme/chatDefaults"

/**
 * Standard header component for bubbles with semantic styling
 */
export const BubbleHeader: React.FC<{
	icon: string
	title: string
	expandable?: boolean
	expanded?: boolean
	onToggle?: () => void
	subtitle?: string
	classification?: MessageStyle
}> = ({ icon, title, expandable, expanded, onToggle, subtitle, classification }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)

	const headerStyle = classification?.semantic
		? {
				background: semanticTheme.headerGradient,
				color: semanticTheme.primary,
				textShadow: "0 1px 2px rgba(0,0,0,0.1)",
				boxShadow: (semanticTheme as any).headerShadow || "none",
				borderRadius: "8px 8px 0 0",
			}
		: {}

	return (
		<div
			className={`flex items-center py-2 px-3 ${expandable ? "cursor-pointer" : ""}`}
			style={headerStyle}
			onClick={expandable ? onToggle : undefined}>
			<span
				className={`codicon codicon-${icon} mr-2 text-sm`}
				style={classification?.semantic ? { color: semanticTheme.primary } : {}}
			/>
			<span className="flex-1 text-sm font-medium truncate">
				{title}
				{subtitle && (
					<span
						className="ml-2 font-normal opacity-90"
						style={
							classification?.semantic
								? { color: semanticTheme.primary }
								: { color: "var(--vscode-foreground)" }
						}>
						{subtitle}
					</span>
				)}
			</span>
			{expandable && (
				<span
					className={`codicon codicon-chevron-${expanded ? "up" : "down"} text-xs opacity-80`}
					style={classification?.semantic ? { color: semanticTheme.primary } : {}}
				/>
			)}
		</div>
	)
}
