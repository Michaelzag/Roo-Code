import { useMemo } from "react"
import { cn } from "@src/lib/utils"
import type { MessageStyle, ColorName, PatternName } from "./chatDefaults"
import { SIMPLIFIED_PATTERN_DEFAULTS, getMessageStyleWithDefaults, validateMessageStyling } from "./chatDefaults"
import type { ClineMessage } from "@roo-code/types"

interface ColorTheme {
	border: string
	background: string
	text: string
	bubble: string
	icon: string
}

// Robust semantic color system with VSCode integration
const semanticColors: Record<ColorName, ColorTheme> = {
	blue: {
		border: "border-l-4 border-l-blue-500",
		background: "bg-blue-500/5",
		text: "text-blue-400",
		bubble: "bg-blue-600/15 border border-blue-400/40 text-blue-100 shadow-lg",
		icon: "#007ACC",
	},
	green: {
		border: "border-l-4 border-l-green-500",
		background: "bg-green-500/5",
		text: "text-green-400",
		bubble: "bg-green-500/10 border border-green-500/30 text-vscode-foreground shadow-lg",
		icon: "#4CAF50",
	},
	red: {
		border: "border-l-4 border-l-red-500",
		background: "bg-red-500/5",
		text: "text-red-400",
		bubble: "bg-red-500/10 border border-red-500/40 text-vscode-foreground shadow-lg",
		icon: "#F44336",
	},
	yellow: {
		border: "border-l-4 border-l-yellow-500",
		background: "bg-yellow-500/5",
		text: "text-yellow-400",
		bubble: "bg-yellow-500/10 border border-yellow-500/30 text-vscode-foreground shadow-lg",
		icon: "#F59E0B", // Enhanced amber for better contrast
	},
	purple: {
		border: "border-l-4 border-l-purple-500",
		background: "bg-purple-500/5",
		text: "text-purple-200",
		bubble: "bg-purple-600/15 border border-purple-400/40 text-purple-100 shadow-lg",
		icon: "#A855F7",
	},
	teal: {
		border: "border-l-4 border-l-teal-500",
		background: "bg-teal-500/5",
		text: "text-teal-400",
		bubble: "bg-teal-500/10 border border-teal-500/30 text-vscode-foreground shadow-lg",
		icon: "#14B8A6",
	},
	orange: {
		border: "border-l-4 border-l-orange-500",
		background: "bg-orange-500/5",
		text: "text-orange-400",
		bubble: "bg-orange-500/10 border border-orange-500/30 text-vscode-foreground shadow-lg",
		icon: "#F97316", // Enhanced orange for better contrast
	},
	cyan: {
		border: "border-l-4 border-l-cyan-500",
		background: "bg-cyan-500/5",
		text: "text-cyan-400",
		bubble: "bg-cyan-500/10 border border-cyan-500/30 text-vscode-foreground shadow-lg",
		icon: "#06B6D4",
	},
	gray: {
		border: "border-l-4 border-l-gray-500",
		background: "bg-gray-500/5",
		text: "text-gray-400",
		bubble: "bg-gray-500/8 border border-gray-500/20 text-vscode-foreground shadow-md",
		icon: "#6B7280",
	},
	pink: {
		border: "border-l-4 border-l-pink-500",
		background: "bg-pink-500/5",
		text: "text-pink-400",
		bubble: "bg-pink-500/10 border border-pink-500/30 text-vscode-foreground shadow-lg",
		icon: "#EC4899",
	},
	indigo: {
		border: "border-l-4 border-l-indigo-500",
		background: "bg-indigo-500/5",
		text: "text-indigo-400",
		bubble: "bg-indigo-500/10 border border-indigo-500/30 text-vscode-foreground shadow-lg",
		icon: "#6366F1",
	},
} as const

// Safe color access with fallback
const getColorTheme = (color?: ColorName): ColorTheme => {
	if (!color || !semanticColors[color]) {
		console.warn(`Invalid color: ${color}, falling back to blue`)
		return semanticColors.blue
	}
	return semanticColors[color]
}

// Enhanced styling function with robust defaults
const getMessageClassesWithDefaults = (style: MessageStyle, message: ClineMessage): string => {
	// Enhance style with defaults if needed
	const enhancedStyle = getMessageStyleWithDefaults(style, message)

	// Validate in development
	validateMessageStyling(message, enhancedStyle)

	// Component overrides handle their own styling
	if (enhancedStyle.type === "component-override") {
		return ""
	}

	// Get theme data with guaranteed fallbacks
	const colorTheme = getColorTheme(enhancedStyle.color)
	const pattern = enhancedStyle.pattern || "status-bar"
	const variant = enhancedStyle.variant || "work"

	// Apply styling based on pattern type
	switch (pattern) {
		case "bubble": {
			const bubbleConfig = SIMPLIFIED_PATTERN_DEFAULTS.bubble
			let classes = bubbleConfig.classes

			// Add variant-specific positioning, sizing, and padding
			if (variant === "user" && "variants" in bubbleConfig && bubbleConfig.variants) {
				classes += ` ${bubbleConfig.variants.user} ${bubbleConfig.maxWidth}`
			} else if (variant === "agent" && "variants" in bubbleConfig && bubbleConfig.variants) {
				classes += ` ${bubbleConfig.variants.agent} ${bubbleConfig.maxWidth}`
			} else {
				// work variant gets its own sizing and padding
				if ("variants" in bubbleConfig && bubbleConfig.variants) {
					classes += ` ${bubbleConfig.variants.work}`
				}
			}

			return cn(classes, colorTheme.bubble)
		}

		case "status-bar": {
			const statusConfig = SIMPLIFIED_PATTERN_DEFAULTS["status-bar"]
			return cn(statusConfig.classes, statusConfig.maxWidth, colorTheme.background)
		}

		default: {
			// Ultimate fallback - guaranteed to work
			const safeConfig = SIMPLIFIED_PATTERN_DEFAULTS["status-bar"]
			return cn(safeConfig.classes, safeConfig.maxWidth, colorTheme.background)
		}
	}
}

export const useChatTheme = () => {
	const getMessageClasses = useMemo(() => {
		return (style: MessageStyle, message?: ClineMessage): string => {
			if (!message) {
				// Fallback for missing message
				return getGuaranteedClasses(style)
			}
			return getMessageClassesWithDefaults(style, message)
		}
	}, [])

	const getIconColor = useMemo(() => {
		return (style: MessageStyle): string => {
			const colorTheme = getColorTheme(style.color)
			return colorTheme.icon
		}
	}, [])

	const getHeaderClasses = useMemo(() => {
		return (style: MessageStyle): string => {
			const colorTheme = getColorTheme(style.color)
			const color = style.color || "blue"

			// Enhanced header styling for important operations
			const enhancedClasses = ["flex items-center gap-2 mb-2 font-semibold text-sm", colorTheme.text]

			// Add enhanced styling for key colors
			if (color === "yellow") {
				enhancedClasses.push("text-yellow-300 font-bold")
			} else if (color === "orange") {
				enhancedClasses.push("text-orange-300 font-bold")
			} else if (color === "red") {
				enhancedClasses.push("text-red-300 font-bold")
			} else if (color === "cyan") {
				enhancedClasses.push("text-cyan-300 font-bold")
			}

			return cn(...enhancedClasses)
		}
	}, [])

	// Type-safe component registries
	const getOverrideComponent = useMemo(() => {
		const overrideComponents = {
			"api-request": "ApiRequestCard",
			"subtask-result": "SubtaskResultCard",
			"context-condense": "ContextCondenseRow",
			"task-completed": "TaskCompletedRow",
		} as const

		return (componentName: string) => {
			if (componentName in overrideComponents) {
				return overrideComponents[componentName as keyof typeof overrideComponents]
			}
			console.warn(`Unknown override component: ${componentName}`)
			return null
		}
	}, [])

	const getPatternComponent = useMemo(() => {
		const patternComponents = {
			bubble: "Bubble",
			"status-bar": "StatusBar",
		} as const

		return (patternName: string) => {
			if (patternName in patternComponents) {
				return patternComponents[patternName as keyof typeof patternComponents]
			}
			console.warn(`Unknown pattern component: ${patternName}`)
			return "StatusBar" // Safe fallback
		}
	}, [])

	// Validation utilities for external use
	const isValidColor = (color: string): color is ColorName => {
		return color in semanticColors
	}

	const isValidPattern = (pattern: string): pattern is PatternName => {
		return pattern in SIMPLIFIED_PATTERN_DEFAULTS
	}

	return {
		getMessageClasses,
		getIconColor,
		getHeaderClasses,
		getOverrideComponent,
		getPatternComponent,
		isValidColor,
		isValidPattern,
		semanticColors,
		SIMPLIFIED_PATTERN_DEFAULTS,
	}
}

// Utility: Guaranteed styling - this can NEVER fail
export const getGuaranteedClasses = (style: Partial<MessageStyle>): string => {
	const pattern = style.pattern || "status-bar"
	const color = style.color || SIMPLIFIED_PATTERN_DEFAULTS[pattern].defaultColor

	const patternConfig = SIMPLIFIED_PATTERN_DEFAULTS[pattern]
	const colorTheme = semanticColors[color] || semanticColors.blue

	return cn(
		patternConfig.classes,
		patternConfig.maxWidth || "max-w-full",
		colorTheme.bubble || "bg-gray-100/10 border border-gray-300/30",
	)
}
