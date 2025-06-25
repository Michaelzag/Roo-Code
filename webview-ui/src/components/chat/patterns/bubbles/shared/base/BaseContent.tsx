import React from "react"
import type { MessageStyle } from "../../../../theme/chatDefaults"
import { getSemanticTheme, DESIGN_SYSTEM } from "../../../../theme/chatDefaults"
import { useBaseTypography } from "../TypographyInheritance"

/**
 * BaseContent - Foundation content area that all bubbles inherit from
 * Provides consistent semantic backgrounds, padding, text styling
 * Single source of truth for content area styling
 */
export const BaseContent: React.FC<{
	children: React.ReactNode
	classification: MessageStyle
	className?: string
}> = ({ children, classification, className = "" }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)
	const { style: contentTypography } = useBaseTypography("content")

	return (
		<div
			className={`${DESIGN_SYSTEM.spacing.baseContentPadding} text-vscode-foreground ${className}`}
			style={{
				...contentTypography,
				background: semanticTheme.background,
			}}>
			{children}
		</div>
	)
}
