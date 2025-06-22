import React from "react"
import { cn } from "@src/lib/utils"
import { DESIGN_TOKENS } from "../theme/chatDefaults"

interface CardHeaderProps {
	icon: string
	title: string
	color: string
	badge?: React.ReactNode
	className?: string
	iconSize?: number
	titleSize?: string
	onClick?: () => void
}

/**
 * CardHeader Component - Using Proven Design Tokens
 *
 * Shared header pattern that preserves the exact styling from current components
 * while providing reusable architecture. Extracted from TaskCompletedRow,
 * ContextCondenseRow, and ApiRequestCard proven implementations.
 */
export const CardHeader: React.FC<CardHeaderProps> = ({
	icon,
	title,
	color,
	badge,
	className,
	iconSize = 14,
	titleSize = "16px",
	onClick,
}) => {
	return (
		<div
			className={cn("flex items-center justify-between transition-all duration-200", className)}
			style={{
				gap: DESIGN_TOKENS.spacing.elementGap,
				cursor: onClick ? "pointer" : "default",
			}}
			onClick={onClick}>
			<div style={{ display: "flex", alignItems: "center", gap: DESIGN_TOKENS.spacing.elementGap }}>
				<span
					className={`codicon codicon-${icon}`}
					style={{
						color,
						fontSize: iconSize,
						fontWeight: "bold",
					}}
				/>
				<span
					style={{
						color: "var(--vscode-foreground)",
						fontWeight: "700",
						fontSize: titleSize,
					}}>
					{title}
				</span>
				{badge}
			</div>
		</div>
	)
}

/**
 * Utility: Create standardized badge component using design tokens
 */
interface BadgeProps {
	children: React.ReactNode
	color: string
	gradient?: boolean
	size?: "sm" | "md" | "lg"
	className?: string
}

export const Badge: React.FC<BadgeProps> = ({ children, color, gradient = false, size = "sm", className }) => {
	const sizeStyles = {
		sm: DESIGN_TOKENS.spacing.headerPadding,
		md: DESIGN_TOKENS.spacing.badgePadding,
		lg: DESIGN_TOKENS.spacing.badgePaddingLg,
	}

	return (
		<div
			className={cn("font-semibold text-xs", className)}
			style={{
				borderRadius: DESIGN_TOKENS.radius.badge,
				padding: sizeStyles[size],
				background: gradient
					? `linear-gradient(45deg, ${color}, #f59e0b)`
					: `color-mix(in srgb, ${color} 25%, var(--vscode-editor-background))`,
				border: `${DESIGN_TOKENS.borders.content} ${gradient ? "transparent" : `color-mix(in srgb, ${color} 50%, transparent)`}`,
				color: gradient ? "white" : color,
				fontSize: "13px",
				textShadow: gradient ? "0 1px 2px rgba(0,0,0,0.3)" : undefined,
				boxShadow: gradient ? `0 2px 6px color-mix(in srgb, #f59e0b 30%, transparent)` : undefined,
			}}>
			{children}
		</div>
	)
}
