import React from "react"
import { cn } from "@src/lib/utils"
import { DESIGN_TOKENS } from "../theme/chatDefaults"

interface OverrideContentProps {
	children: React.ReactNode
	className?: string
	topBorder?: boolean
	backgroundColor?: string
}

/**
 * OverrideContent - Consistent Content Section for Override Components
 *
 * Provides the standard content layout with consistent padding, borders, and background
 * used by TaskCompleted, ContextCondense, and ApiRequest components.
 */
export const OverrideContent: React.FC<OverrideContentProps> = ({
	children,
	className,
	topBorder = true,
	backgroundColor = "var(--vscode-textCodeBlock-background)",
}) => {
	return (
		<div
			className={cn("", className)}
			style={{
				padding: DESIGN_TOKENS.spacing.contentPadding,
				borderTop: topBorder
					? `${DESIGN_TOKENS.borders.thin} color-mix(in srgb, var(--vscode-foreground) 20%, transparent)`
					: "none",
				backgroundColor,
			}}>
			{children}
		</div>
	)
}

interface OverrideContentSectionProps {
	children: React.ReactNode
	title?: string
	titleIcon?: string
	className?: string
	backgroundColor?: string
	borderColor?: string
}

/**
 * OverrideContentSection - Individual content sections within override components
 */
export const OverrideContentSection: React.FC<OverrideContentSectionProps> = ({
	children,
	title,
	titleIcon,
	className,
	backgroundColor,
	borderColor,
}) => {
	const sectionBackground =
		backgroundColor || `color-mix(in srgb, var(--vscode-foreground) 3%, var(--vscode-input-background))`
	const sectionBorder = borderColor || `color-mix(in srgb, var(--vscode-foreground) 20%, var(--vscode-input-border))`

	return (
		<div
			className={cn("", className)}
			style={{
				marginBottom: DESIGN_TOKENS.spacing.sectionGap,
				padding: DESIGN_TOKENS.spacing.innerPadding,
				background: sectionBackground,
				borderRadius: DESIGN_TOKENS.radius.content,
				border: `${DESIGN_TOKENS.borders.thin} ${sectionBorder}`,
			}}>
			{title && (
				<h4
					style={{
						margin: `0 0 ${DESIGN_TOKENS.spacing.elementGap} 0`,
						color: "var(--vscode-foreground)",
						fontSize: DESIGN_TOKENS.typography.content,
						fontWeight: "700",
						display: "flex",
						alignItems: "center",
						gap: DESIGN_TOKENS.spacing.elementGap,
					}}>
					{titleIcon && (
						<span
							className={`codicon codicon-${titleIcon}`}
							style={{ fontSize: DESIGN_TOKENS.typography.content }}
						/>
					)}
					{title}
				</h4>
			)}
			{children}
		</div>
	)
}

interface OverrideGridProps {
	children: React.ReactNode
	columns?: string
	gap?: string
	className?: string
}

/**
 * OverrideGrid - Consistent grid layout for stats and information display
 */
export const OverrideGrid: React.FC<OverrideGridProps> = ({
	children,
	columns = "repeat(auto-fit, minmax(140px, 1fr))",
	gap = DESIGN_TOKENS.spacing.sectionGap,
	className,
}) => {
	return (
		<div
			className={cn("", className)}
			style={{
				display: "grid",
				gridTemplateColumns: columns,
				gap,
				fontSize: DESIGN_TOKENS.typography.small,
				color: "var(--vscode-foreground)",
			}}>
			{children}
		</div>
	)
}

interface OverrideStatProps {
	label: string
	value: React.ReactNode
	highlight?: boolean
	highlightColor?: string
}

/**
 * OverrideStat - Individual stat display within grids
 */
export const OverrideStat: React.FC<OverrideStatProps> = ({
	label,
	value,
	highlight = false,
	highlightColor = "var(--vscode-foreground)",
}) => {
	return (
		<div>
			<strong>{label}:</strong>
			<br />
			<span
				style={{
					color: highlight ? highlightColor : "inherit",
					fontWeight: highlight ? "600" : "normal",
				}}>
				{value}
			</span>
		</div>
	)
}
