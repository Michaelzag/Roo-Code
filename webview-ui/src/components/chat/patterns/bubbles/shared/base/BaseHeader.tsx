import React from "react"
import type { MessageStyle } from "../../../../theme/chatDefaults"
import { getSemanticTheme, DESIGN_SYSTEM } from "../../../../theme/chatDefaults"
import { useBaseTypography } from "../TypographyInheritance"

/**
 * BaseHeader - Foundation header that all bubbles inherit from
 * Provides consistent semantic theming, gradients, icon placement
 * Single source of truth for header styling
 */
export const BaseHeader: React.FC<{
	icon: React.ReactNode
	title: React.ReactNode
	subtitle?: string
	expandable?: boolean
	expanded?: boolean
	onToggle?: () => void
	classification: MessageStyle
	className?: string
}> = ({ icon, title, subtitle, expandable, expanded, onToggle, classification, className = "" }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)
	const { style: headerTypography } = useBaseTypography("header")

	// Helper to safely get font size as number
	const getFontSizeNumber = (fontSize: string | number | undefined): number => {
		if (typeof fontSize === "number") return fontSize
		if (typeof fontSize === "string") return parseFloat(fontSize) || 16
		return 16
	}

	const baseFontSize = getFontSizeNumber(headerTypography.fontSize)

	return (
		<div
			className={`flex items-center ${DESIGN_SYSTEM.spacing.baseHeaderPadding} ${expandable ? "cursor-pointer" : ""} ${className}`}
			style={{
				background: semanticTheme.headerGradient,
				color: semanticTheme.primary,
				textShadow: "0 1px 2px rgba(0,0,0,0.1)",
				boxShadow: (semanticTheme as any).headerShadow || "none",
			}}
			onClick={expandable ? onToggle : undefined}>
			<div className="flex items-center gap-2">
				{typeof icon === "string" ? (
					<span
						className={`codicon codicon-${icon}`}
						style={{
							color: semanticTheme.primary,
							fontSize: `${baseFontSize * 0.875}px`, // Icons slightly smaller than text
						}}
					/>
				) : (
					icon
				)}
			</div>
			<span
				className="flex-1 truncate ml-2"
				style={{
					...headerTypography,
					color: semanticTheme.primary,
				}}>
				{title}
				{subtitle && (
					<span
						className="ml-2 opacity-90"
						style={{
							...headerTypography,
							fontWeight: 400, // Override to normal weight for subtitle
							color: semanticTheme.primary,
						}}>
						{subtitle}
					</span>
				)}
			</span>
			{expandable && (
				<span
					className={`codicon codicon-chevron-${expanded ? "up" : "down"} opacity-80`}
					style={{
						color: semanticTheme.primary,
						fontSize: `${baseFontSize * 0.75}px`, // Chevron smaller than text
					}}
				/>
			)}
		</div>
	)
}
