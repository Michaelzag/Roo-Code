import React from "react"
import type { MessageStyle } from "../../../../theme/chatDefaults"
import { getSemanticTheme } from "../../../../theme/chatDefaults"

/**
 * BaseContainer - Foundation container that all bubbles inherit from
 * Provides consistent borders, shadows, semantic backgrounds
 * Single source of truth for container styling
 */
export const BaseContainer: React.FC<{
	children: React.ReactNode
	classification: MessageStyle
	className?: string
}> = ({ children, classification, className = "" }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)

	return (
		<div
			className={`overflow-hidden rounded-lg ${className}`}
			style={{
				border: (semanticTheme as any).borderStyle || "1px solid var(--vscode-panel-border)",
				boxShadow: `0 2px 8px ${semanticTheme.shadowColor}`,
			}}>
			{children}
		</div>
	)
}
