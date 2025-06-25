/**
 * Typography Inheritance System for Scalable Bubble Components
 *
 * Provides centralized typography scaling that integrates with:
 * - Semantic theming system
 * - Base components (BaseHeader, BaseContent)
 * - Factory pattern (createBubbleComponent)
 * - User preference scaling
 *
 * Architecture: Typography scales inherit from semantic types and user preferences,
 * then provide context-specific variations for specialized UI elements.
 */

import React, { createContext, useContext } from "react"
import { cn } from "../../../../../lib/utils"
import type { SemanticType } from "../../../theme/chatDefaults"

/**
 * Typography scale multipliers for different semantic types
 * Some bubbles need slightly larger/smaller text for their content type
 */
const SEMANTIC_SCALE_MODIFIERS = {
	thinking: 1.0, // Standard scale for reasoning content
	error: 0.95, // Slightly smaller for dense error info
	"file-read": 0.95, // Smaller for file lists and paths
	"file-write": 0.95, // Smaller for file operations
	"file-search": 0.95, // Smaller for search results
	"codebase-search": 0.9, // Smaller for dense search results with code
	"mode-change": 1.05, // Slightly larger for important mode changes
	command: 1.0, // Standard scale - base code-inline size now adequate
	completion: 1.0, // Standard for user interactions
	search: 0.95, // Smaller for search results
	"user-input": 1.0, // Standard for user messages
	"agent-response": 1.0, // Standard for agent text
	browser: 0.95, // Smaller for browser interaction details
	mcp: 0.95, // Smaller for technical MCP details
	api: 0.95, // Smaller for API request/response details
	subtask: 1.0, // Standard for subtask descriptions
	context: 0.95, // Smaller for context operations
	checkpoint: 1.0, // Standard for checkpoints
} as const

/**
 * User scaling preferences (will be controlled by user settings)
 * Base scale that affects all typography in bubbles
 */
interface TypographyScale {
	baseScale: number // 0.8 = 80%, 1.0 = 100%, 1.2 = 120%
	lineHeightScale: number // Proportional line height scaling
	codeScale: number // Separate scaling for code elements
}

const DEFAULT_SCALE: TypographyScale = {
	baseScale: 1.0,
	lineHeightScale: 1.0,
	codeScale: 0.95, // Code is typically slightly smaller
}

/**
 * Typography contexts for different UI elements within bubbles
 */
export type TypographyContext =
	| "header" // Bubble headers (inherits from BaseHeader)
	| "content" // Main content areas (inherits from BaseContent)
	| "badge" // Status badges, indicators
	| "metadata" // Secondary info, timestamps, usage stats
	| "code-inline" // Inline code, file paths, short commands
	| "code-block" // Code blocks, terminal output, JSON
	| "emphasis" // Important callouts, warnings, success messages
	| "micro" // Very small text, icons, subtle indicators
	| "score" // Numerical scores, percentages (for search results)

/**
 * Typography Context for providing scale to components
 */
const TypographyContext = createContext<{
	scale: TypographyScale
	semantic?: SemanticType
}>({
	scale: DEFAULT_SCALE,
})

/**
 * Typography Provider - integrates with bubble factory
 */
export const TypographyProvider: React.FC<{
	children: React.ReactNode
	semantic?: SemanticType
	userScale?: Partial<TypographyScale>
}> = ({ children, semantic, userScale }) => {
	const scale = { ...DEFAULT_SCALE, ...userScale }

	return <TypographyContext.Provider value={{ scale, semantic }}>{children}</TypographyContext.Provider>
}

/**
 * Hook to get typography styles for a specific context
 */
export const useTypography = (context: TypographyContext) => {
	const { scale, semantic } = useContext(TypographyContext)

	// Get semantic scale modifier
	const semanticModifier = semantic ? SEMANTIC_SCALE_MODIFIERS[semantic] || 1.0 : 1.0

	// Calculate final scale
	const finalScale = scale.baseScale * semanticModifier
	const codeScale = scale.codeScale * semanticModifier
	const lineHeightScale = scale.lineHeightScale

	// Base typography definitions with relative scaling
	const getTypographyStyle = (): React.CSSProperties => {
		switch (context) {
			case "header":
				return {
					fontSize: `${16 * finalScale}px`, // Based on chat-subheader-typography
					fontWeight: 600,
					lineHeight: 1.3 * lineHeightScale,
					fontFamily: "var(--vscode-font-family)",
				}

			case "content":
				return {
					fontSize: `${14 * finalScale}px`, // Based on chat-content-typography
					fontWeight: 400,
					lineHeight: 1.4 * lineHeightScale,
					fontFamily: "var(--vscode-font-family)",
				}

			case "badge":
				return {
					fontSize: `${12 * finalScale}px`,
					fontWeight: 500,
					lineHeight: 1.2 * lineHeightScale,
					fontFamily: "var(--vscode-font-family)",
				}

			case "metadata":
				return {
					fontSize: `${12 * finalScale}px`, // Based on chat-small-typography
					fontWeight: 400,
					lineHeight: 1.3 * lineHeightScale,
					fontFamily: "var(--vscode-font-family)",
				}

			case "code-inline":
				return {
					fontSize: `${14 * codeScale}px`,
					fontWeight: 400,
					lineHeight: 1.3 * lineHeightScale,
					fontFamily: "var(--vscode-editor-font-family, Monaco, monospace)",
				}

			case "code-block":
				return {
					fontSize: `${12 * codeScale}px`,
					fontWeight: 400,
					lineHeight: 1.5 * lineHeightScale, // Code blocks need more line height
					fontFamily: "var(--vscode-editor-font-family, Monaco, monospace)",
				}

			case "emphasis":
				return {
					fontSize: `${14 * finalScale}px`,
					fontWeight: 600,
					lineHeight: 1.3 * lineHeightScale,
					fontFamily: "var(--vscode-font-family)",
				}

			case "micro":
				return {
					fontSize: `${11 * finalScale}px`,
					fontWeight: 400,
					lineHeight: 1.2 * lineHeightScale,
					fontFamily: "var(--vscode-font-family)",
				}

			case "score":
				return {
					fontSize: `${16 * finalScale}px`, // Replaces hardcoded 18px in CodebaseSearchBubble
					fontWeight: 700,
					lineHeight: 1.0,
					fontFamily: "var(--vscode-editor-font-family, Monaco, monospace)",
				}

			default:
				return getTypographyStyle() // Fallback to content
		}
	}

	return {
		style: getTypographyStyle(),
		className: cn(
			// Always include the original chat typography classes for compatibility
			context === "header" && "chat-subheader-typography-base",
			context === "content" && "chat-content-typography-base",
			context === "metadata" && "chat-small-typography-base",
			// Add context-specific utility classes
			(context === "code-inline" || context === "code-block") && "font-mono",
			context === "micro" && "opacity-70",
		),
	}
}

/**
 * Typography component with automatic scaling
 */
export const ScaledText: React.FC<{
	context: TypographyContext
	children: React.ReactNode
	className?: string
	as?: keyof JSX.IntrinsicElements
	weight?: "normal" | "medium" | "semibold" | "bold"
	style?: React.CSSProperties
}> = ({ context, children, className = "", as: Component = "span", weight, style: customStyle }) => {
	const { style, className: typographyClass } = useTypography(context)

	const weightClass = weight
		? {
				normal: "font-normal",
				medium: "font-medium",
				semibold: "font-semibold",
				bold: "font-bold",
			}[weight]
		: ""

	return (
		<Component style={{ ...style, ...customStyle }} className={cn(typographyClass, weightClass, className)}>
			{children}
		</Component>
	)
}

/**
 * Pre-configured components for common patterns
 */
export const ScaledBadge: React.FC<{
	children: React.ReactNode
	className?: string
	variant?: "default" | "success" | "warning" | "error"
	style?: React.CSSProperties
}> = ({ children, className = "", variant = "default", style }) => {
	const variantClasses = {
		default: "bg-vscode-badge-background text-vscode-badge-foreground border-vscode-panel-border",
		success: "bg-green-500/20 text-green-400 border-green-500/30",
		warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
		error: "bg-red-500/20 text-red-400 border-red-500/30",
	}

	return (
		<ScaledText
			context="badge"
			className={cn("px-2 py-1 rounded-md border", variantClasses[variant], className)}
			style={style}>
			{children}
		</ScaledText>
	)
}

export const ScaledCode: React.FC<{
	children: React.ReactNode
	className?: string
	inline?: boolean
	style?: React.CSSProperties
}> = ({ children, className = "", inline = false, style }) => {
	const context = inline ? "code-inline" : "code-block"

	if (inline) {
		return (
			<ScaledText
				context={context}
				style={style}
				className={cn(
					"px-1 py-0.5 rounded bg-vscode-textCodeBlock-background border border-vscode-panel-border/30",
					className,
				)}>
				{children}
			</ScaledText>
		)
	}

	return (
		<ScaledText
			context={context}
			as="pre"
			style={style}
			className={cn(
				"p-3 rounded bg-vscode-textCodeBlock-background overflow-x-auto border border-vscode-panel-border/30",
				className,
			)}>
			<code>{children}</code>
		</ScaledText>
	)
}

export const ScaledScore: React.FC<{
	children: React.ReactNode
	className?: string
}> = ({ children, className = "" }) => {
	return (
		<ScaledText
			context="score"
			className={cn("flex items-center justify-center text-vscode-foreground", className)}>
			{children}
		</ScaledText>
	)
}

/**
 * Scaled icon component for codicons and other icons
 */
export const ScaledIcon: React.FC<{
	className: string
	context?: TypographyContext
	style?: React.CSSProperties
}> = ({ className, context = "micro", style }) => {
	const { style: iconStyle } = useTypography(context)

	return (
		<span
			className={className}
			style={{
				...iconStyle,
				...style,
			}}
		/>
	)
}

/**
 * Hook for base components to get their typography styles
 * Used by BaseHeader and BaseContent for consistent scaling
 */
export const useBaseTypography = (component: "header" | "content") => {
	return useTypography(component)
}
