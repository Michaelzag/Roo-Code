import React from "react"
import { cn } from "@src/lib/utils"
import { DESIGN_TOKENS } from "../theme/chatDefaults"

interface OverrideHeaderProps {
	icon: string
	title: string
	badge?: React.ReactNode
	rightContent?: React.ReactNode
	onClick?: () => void
	isExpanded?: boolean
	iconColor?: string
	className?: string
	theme?: "celebration" | "subtle" | "standard"
}

/**
 * OverrideHeader - Consistent Header for Override Components
 *
 * Provides the standard header layout used by TaskCompleted, ContextCondense, and ApiRequest
 * with consistent icon, title, badge, and expand/collapse patterns.
 */
export const OverrideHeader: React.FC<OverrideHeaderProps> = ({
	icon,
	title,
	badge,
	rightContent,
	onClick,
	isExpanded,
	iconColor = "var(--vscode-foreground)",
	className,
	theme = "standard",
}) => {
	// Get theme-specific styling
	const themeData = DESIGN_TOKENS.themes[theme]
	const effectiveIconColor = theme !== "standard" ? themeData.colors.primary : iconColor
	return (
		<div
			className={cn(
				"flex items-center justify-between gap-3 transition-all duration-200",
				onClick && "cursor-pointer",
				className,
			)}
			onClick={onClick}>
			{/* Left section: Icon, title, and badge */}
			<div className="flex items-center gap-3">
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						width: DESIGN_TOKENS.icons.badge,
						height: DESIGN_TOKENS.icons.badge,
						borderRadius: "50%",
						background:
							theme === "celebration" && "icon" in themeData.gradients
								? themeData.gradients.icon
								: effectiveIconColor,
						border: `2px solid ${theme !== "standard" ? themeData.colors.darkPrimary : effectiveIconColor}`,
						boxShadow:
							theme !== "standard"
								? "icon" in themeData.shadows
									? themeData.shadows.icon
									: themeData.shadows.glow
								: `${DESIGN_TOKENS.shadows.badge} color-mix(in srgb, ${effectiveIconColor} 40%, transparent)`,
					}}>
					<span
						className={`codicon codicon-${icon}`}
						style={{
							color: "white",
							fontSize: DESIGN_TOKENS.icons.standard,
							fontWeight: "bold",
						}}
					/>
				</div>

				<span
					style={{
						color: "var(--vscode-foreground)",
						fontWeight: "700",
						fontSize: DESIGN_TOKENS.typography.headerTitle,
					}}>
					{title}
				</span>

				{badge}
			</div>

			{/* Right section: Content and chevron */}
			<div className="flex items-center gap-3">
				{rightContent}

				{onClick && isExpanded !== undefined && (
					<span
						className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
						style={{
							fontSize: DESIGN_TOKENS.icons.large,
							color: iconColor,
							transition: "transform 0.2s ease",
						}}
					/>
				)}
			</div>
		</div>
	)
}

interface OverrideBadgeProps {
	children: React.ReactNode
	color?: string
	background?: string
	className?: string
}

/**
 * OverrideBadge - Consistent Badge Styling
 */
export const OverrideBadge: React.FC<OverrideBadgeProps> = ({
	children,
	color = "var(--vscode-foreground)",
	background,
	className,
}) => {
	const badgeBackground =
		background || `color-mix(in srgb, ${color} ${DESIGN_TOKENS.colorMix.badge}, var(--vscode-editor-background))`

	return (
		<div
			className={cn("inline-flex items-center", className)}
			style={{
				background: badgeBackground,
				border: `1px solid ${color}`,
				borderRadius: DESIGN_TOKENS.radius.badge,
				padding: DESIGN_TOKENS.spacing.badgePadding,
				color,
				fontWeight: "700",
				fontSize: DESIGN_TOKENS.typography.badge,
			}}>
			{children}
		</div>
	)
}

interface OverrideGradientBadgeProps {
	children: React.ReactNode
	gradientFrom: string
	gradientTo: string
	className?: string
}

/**
 * OverrideGradientBadge - For special celebration badges (TaskCompleted)
 */
export const OverrideGradientBadge: React.FC<OverrideGradientBadgeProps> = ({
	children,
	gradientFrom,
	gradientTo,
	className,
}) => {
	return (
		<div
			className={cn("inline-flex items-center", className)}
			style={{
				background: `linear-gradient(45deg, ${gradientFrom}, ${gradientTo})`,
				borderRadius: DESIGN_TOKENS.radius.badge,
				padding: DESIGN_TOKENS.spacing.badgePaddingLg,
				color: "white",
				fontWeight: "700",
				fontSize: DESIGN_TOKENS.typography.badge,
				textShadow: "0 1px 2px rgba(0,0,0,0.3)",
				boxShadow: `${DESIGN_TOKENS.shadows.badge} color-mix(in srgb, ${gradientTo} 30%, transparent)`,
			}}>
			{children}
		</div>
	)
}
