import React from "react"
import { cn } from "@src/lib/utils"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../theme/chatDefaults"
import { DESIGN_SYSTEM, getSemanticTheme } from "../theme/chatDefaults"
import { useChatTheme } from "../theme/useChatTheme"
import { Markdown } from "../Markdown"

interface BubbleUnifiedProps {
	message: ClineMessage
	classification: MessageStyle
	children?: React.ReactNode
	header?: React.ReactNode
	className?: string
	onClick?: () => void
	style?: React.CSSProperties
	// Component overriding for inheritance
	headerComponent?: React.ComponentType<any>
	contentComponent?: React.ComponentType<any>
	styleOverrides?: React.CSSProperties
	headerProps?: any
	contentProps?: any
}

/**
 * BubbleUnified - The Foundation Component
 *
 * This is the unified base that ALL chat elements inherit from.
 * Provides consistent spacing, borders, shadows, and color systems.
 *
 * Variants:
 * - user: Right-aligned user messages with blue styling
 * - agent: Left-aligned agent responses with green styling
 * - work: Full-width work operations with contextual colors
 * - override: Special styling for override components
 */
export const BubbleUnified: React.FC<BubbleUnifiedProps> = ({
	message,
	classification,
	children,
	header,
	className,
	onClick,
	style,
	headerComponent: HeaderComponent,
	contentComponent: ContentComponent,
	styleOverrides,
	headerProps,
	contentProps,
}) => {
	const { semanticColors } = useChatTheme()

	const variant = classification.variant || "work"
	const color = classification.color || "blue"
	const colorTheme = semanticColors[color] || semanticColors.blue

	// Get semantic theme for enhanced styling
	const semanticTheme = getSemanticTheme(classification.semantic)

	// Helper to get theme-aware gradient safely
	const getAccentGradient = () => {
		// Use semantic theme gradient if available
		if (classification.semantic && semanticTheme) {
			return semanticTheme.headerGradient
		}

		if (!classification.theme) {
			return `linear-gradient(90deg, ${colorTheme.icon}, ${colorTheme.icon.replace(/[0-9.]+$/, "0.8")}, ${colorTheme.icon})`
		}

		const theme = DESIGN_SYSTEM.themes[classification.theme]
		if ("accent" in theme.gradients) {
			return theme.gradients.accent
		}
		return (
			theme.gradients.primary ||
			`linear-gradient(90deg, ${colorTheme.icon}, ${colorTheme.icon.replace(/[0-9.]+$/, "0.8")}, ${colorTheme.icon})`
		)
	}

	// Base classes that apply to ALL bubble variants
	const baseClasses = cn(
		"rounded-lg shadow-sm overflow-hidden transition-all duration-200 semantic-bubble",
		onClick && "cursor-pointer hover:shadow-md",
		variant === "work" && classification.semantic && "semantic-shadow-md",
	)

	// Variant-specific positioning and sizing
	const variantClasses = {
		user: cn(
			"ml-auto max-w-[85%] rounded-br-md",
			DESIGN_SYSTEM.spacing.bubblePadding,
			DESIGN_SYSTEM.spacing.bubbleMargin,
			colorTheme.bubble,
		),
		agent: cn(
			"mr-auto max-w-[85%] rounded-tl-md",
			DESIGN_SYSTEM.spacing.bubblePadding,
			DESIGN_SYSTEM.spacing.bubbleMargin,
			colorTheme.bubble,
		),
		work: cn(
			"max-w-[95%] rounded-xl overflow-hidden",
			DESIGN_SYSTEM.spacing.workMargin,
			// Use semantic color theme for all colors - no hardcoded overrides
			colorTheme.bubble,
		),
		override: cn(
			"rounded-lg overflow-hidden",
			className, // Override components control their own styling
		),
	}

	// Content classes based on variant
	const contentClasses = {
		user: "text-base leading-relaxed font-medium",
		agent: "text-base leading-relaxed",
		work: "text-sm leading-relaxed",
		override: "", // Override components handle their own content styling
	}

	// Merge all classes
	const finalClasses = cn(baseClasses, variantClasses[variant], className)

	// Custom styles for enhanced work bubbles and override components
	const getCustomStyles = () => {
		const baseStyle = styleOverrides || style || {}

		if (variant === "override") {
			return {
				margin: DESIGN_SYSTEM.spacing.cardMargin,
				border: classification.theme
					? DESIGN_SYSTEM.themes[classification.theme].borders.main
					: `${DESIGN_SYSTEM.borders.card} ${colorTheme.border.replace("border-l-4 border-l-", "")}`,
				borderRadius: DESIGN_SYSTEM.radius.card,
				background: classification.theme
					? `color-mix(in srgb, ${DESIGN_SYSTEM.themes[classification.theme].colors.primary} ${DESIGN_SYSTEM.themes[classification.theme].effects.backgroundMix}, var(--vscode-editor-background))`
					: `color-mix(in srgb, ${colorTheme.icon} ${DESIGN_SYSTEM.colorMix.background}, var(--vscode-editor-background))`,
				boxShadow: classification.theme
					? DESIGN_SYSTEM.themes[classification.theme].shadows.glow
					: `${DESIGN_SYSTEM.shadows.card} color-mix(in srgb, ${colorTheme.icon} ${DESIGN_SYSTEM.colorMix.shadow}, transparent)`,
				position: "relative" as const,
				...baseStyle,
			}
		}

		// Enhanced styling for work bubbles with semantic themes
		if (variant === "work" && classification.semantic && semanticTheme) {
			return {
				background: semanticTheme.background,
				border: (semanticTheme as any).borderStyle || `1px solid ${semanticTheme.borderColor}`,
				borderLeft: `3px solid ${semanticTheme.borderColor}`,
				boxShadow: `0 2px 8px ${semanticTheme.shadowColor}`,
				borderRadius: "8px",
				position: "relative" as const,
				// CSS custom properties for enhanced styling
				["--semantic-primary-color" as any]: semanticTheme.primary,
				["--semantic-accent-color" as any]: semanticTheme.accent,
				["--semantic-shadow-color" as any]: semanticTheme.shadowColor,
				["--semantic-border-color" as any]: semanticTheme.borderColor,
				["--semantic-header-gradient" as any]: semanticTheme.headerGradient,
				["--semantic-text-accent" as any]: semanticTheme.textAccent,
				["--semantic-icon-color" as any]: semanticTheme.iconColor,
				...baseStyle,
			}
		}

		return baseStyle
	}

	const customStyles = getCustomStyles()

	return (
		<div className={finalClasses} style={customStyles} onClick={onClick}>
			{/* Top accent line for override components */}
			{variant === "override" && (
				<div
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						right: 0,
						height: classification.theme
							? DESIGN_SYSTEM.themes[classification.theme].borders.accent
							: classification.component === "task-completed"
								? "3px"
								: "2px",
						background: getAccentGradient(),
					}}
				/>
			)}

			{/* Header section - supports component overriding */}
			{(HeaderComponent || header) && (
				<div className={variant === "override" ? DESIGN_SYSTEM.spacing.overrideHeaderPadding : ""}>
					{HeaderComponent ? (
						<HeaderComponent message={message} classification={classification} {...(headerProps || {})} />
					) : (
						header
					)}
				</div>
			)}

			{/* Content section - supports component overriding */}
			<div
				className={cn(
					variant === "override" ? DESIGN_SYSTEM.spacing.overrideContentPadding : "",
					contentClasses[variant],
				)}>
				{ContentComponent ? (
					<ContentComponent message={message} classification={classification} {...(contentProps || {})} />
				) : (
					children ||
					(message.text ? (
						<Markdown markdown={message.text} partial={message.partial} />
					) : (
						<span className="opacity-70">No content</span>
					))
				)}
			</div>
		</div>
	)
}

// Note: UserBubble and AgentBubble moved to separate files for consistency
// with the documented bubble pattern architecture

export const WorkBubble: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	children?: React.ReactNode
	className?: string
}> = ({ message, classification, children, className }) => {
	// Explicit work bubble classification - always work variant
	const workClassification: MessageStyle = {
		type: classification?.type || "standard",
		pattern: classification?.pattern || "bubble",
		color: classification?.color || "blue",
		variant: "work", // Always work variant - never overrideable
		component: classification?.component,
		semantic: classification?.semantic,
		theme: classification?.theme,
	}

	return (
		<BubbleUnified message={message} classification={workClassification} className={className}>
			{children}
		</BubbleUnified>
	)
}

export const OverrideBubble: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	header?: React.ReactNode
	children: React.ReactNode
	onClick?: () => void
	className?: string
}> = ({ message, classification, header, children, onClick, className }) => {
	// Explicit override bubble classification - always override variant
	const overrideClassification: MessageStyle = {
		type: classification?.type || "standard",
		pattern: classification?.pattern || "bubble",
		color: classification?.color || "blue",
		variant: "override", // Always override variant - never overrideable
		component: classification?.component,
		semantic: classification?.semantic,
		theme: classification?.theme,
	}

	return (
		<BubbleUnified
			message={message}
			classification={overrideClassification}
			header={header}
			onClick={onClick}
			className={className}>
			{children}
		</BubbleUnified>
	)
}
