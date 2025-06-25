import React from "react"
import type { MessageStyle } from "../../../theme/chatDefaults"
import { getSemanticTheme } from "../../../theme/chatDefaults"
import { BubbleHeader } from "./BubbleHeader"

export const BubbleFrame: React.FC<{
	children: React.ReactNode
	classification: MessageStyle
	icon: string
	title: string
	subtitle?: string
	isExpandable?: boolean
	isExpanded?: boolean
	onToggleExpand?: () => void
}> = ({ children, classification, icon, title, subtitle, isExpandable, isExpanded, onToggleExpand }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)

	return (
		<div
			className="overflow-hidden rounded-lg"
			style={{
				border: (semanticTheme as any).borderStyle || "1px solid var(--vscode-panel-border)",
				boxShadow: `0 2px 8px ${semanticTheme.shadowColor}`,
			}}>
			<BubbleHeader
				icon={icon}
				title={title}
				expandable={isExpandable}
				expanded={isExpanded}
				onToggle={onToggleExpand}
				subtitle={subtitle}
				classification={classification}
			/>
			{isExpanded && (
				<div
					className="p-2 text-sm text-vscode-foreground leading-snug"
					style={{
						background: semanticTheme.background,
					}}>
					{children}
				</div>
			)}
		</div>
	)
}
