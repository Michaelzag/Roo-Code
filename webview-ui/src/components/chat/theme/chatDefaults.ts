/**
 * Chat System Defaults - Centralized Configuration
 *
 * This module provides bulletproof default configurations for the chat system,
 * ensuring that any message, from any contributor, in any state will render properly.
 *
 * DEFAULT BEHAVIOR:
 * - Unknown tools → blue bubble (conversation style)
 * - Malformed messages → gray status-bar (background style)
 * - Failed classification → emergency safe defaults
 *
 * ADDING NEW TOOLS:
 * 1. Add to TOOL_COLOR_RULES with semantic color
 * 2. Override pattern only if special UI needed
 * 3. System provides safe defaults automatically
 *
 * FAIL-SAFES:
 * - Invalid colors → fallback to blue
 * - Invalid patterns → fallback to status-bar
 * - Classification errors → emergency defaults
 * - Component errors → graceful degradation
 */

import type { ClineMessage } from "@roo-code/types"

// Simplified pattern types (reduced from 4 to 2)
export type PatternName = "bubble" | "status-bar"
export type ColorName =
	| "blue"
	| "green"
	| "red"
	| "yellow"
	| "purple"
	| "cyan"
	| "orange"
	| "teal"
	| "gray"
	| "pink"
	| "indigo"
export type MessageType = "standard" | "component-override" | "semantic-override"

// Semantic types that map to specific bubble components
export type SemanticType =
	| "thinking" // Yellow bubbles for reasoning/analysis
	| "error" // Red bubbles for errors/failures
	| "file-read" // Cyan bubbles for file reading operations
	| "file-write" // Orange bubbles for file writing operations
	| "file-search" // Teal bubbles for file search operations
	| "codebase-search" // Indigo bubbles for codebase/semantic search
	| "mode-change" // Purple bubbles for mode switching/task operations
	| "command" // Gray bubbles for shell commands
	| "completion" // Green bubbles for task completion
	| "search" // Pink bubbles for general search operations
	| "user-input" // Blue bubbles for user messages
	| "agent-response" // Green bubbles for agent text responses
	| "browser" // Blue bubbles for browser interactions
	| "mcp" // Purple bubbles for Model Context Protocol operations
	| "api" // Orange bubbles for API request operations
	| "subtask" // Cyan bubbles for subtask management
	| "context" // Gray bubbles for context operations
	| "checkpoint" // Green bubbles for checkpoint operations

export interface MessageStyle {
	type: MessageType
	pattern?: PatternName
	color?: ColorName
	component?: "api-request" | "subtask-result" | "context-condense" | "task-completed"
	semantic?: SemanticType
	variant?: "user" | "agent" | "work" | "override" // For bubble variants
	theme?: "celebration" | "subtle" | "standard" // Theme for appropriate visual treatment
}

// Centralized default configuration - these NEVER fail
export const DEFAULT_STYLE_CONFIG = {
	// Ultimate fallbacks - guaranteed to work
	SAFE_DEFAULTS: {
		color: "blue" as const, // Most neutral color
		pattern: "status-bar" as const, // Least intrusive pattern
		type: "standard" as const, // Simplest classification
		variant: "work" as const, // Default bubble variant
	},

	// Smart defaults based on message context
	CONTEXTUAL_DEFAULTS: {
		unknown_tool: { color: "gray" as const, pattern: "bubble" as const, variant: "work" as const },
		user_message: { color: "blue" as const, pattern: "bubble" as const, variant: "user" as const },
		agent_message: { color: "green" as const, pattern: "bubble" as const, variant: "agent" as const },
		system_message: { color: "gray" as const, pattern: "status-bar" as const },
	},

	// Developer-friendly extension defaults
	NEW_TOOL_DEFAULTS: {
		color: "blue" as const, // Safe assumption for new tools
		pattern: "bubble" as const, // Conversation-style for new operations
		variant: "work" as const,
	},
} as const

// Design Token System - Extracted from current beautiful components
export const DESIGN_TOKENS = {
	// Compact spacing values optimized for streamlined design
	spacing: {
		cardMargin: "8px 0", // Reduced container margin for compactness
		contentPadding: "16px", // Reduced main content padding
		innerPadding: "12px", // Reduced inner content sections
		badgePadding: "3px 8px", // Reduced badge padding
		badgePaddingLg: "4px 10px", // Reduced larger badge padding
		headerPadding: "3px 8px", // Reduced header elements
		elementGap: "6px", // Reduced gap between elements
		sectionGap: "8px", // Reduced gap between sections

		// Bubble-specific spacing - optimized for compact design
		bubblePadding: "px-3 py-2", // Reduced standard bubble padding
		bubbleMargin: "mb-1.5", // Reduced standard bubble margin
		workPadding: "py-1.5 pb-2", // Reduced work operation padding
		workMargin: "my-1", // Compact work margin

		// Header and content spacing for override components
		overrideHeaderPadding: "p-3", // Reduced override component header padding
		overrideContentPadding: "px-3 pb-2 pt-0", // Reduced override component content padding
	},

	// Proven border radius values
	radius: {
		badge: "12px", // Badge border radius
		card: "8px", // Card border radius
		content: "6px", // Content section radius
		small: "4px", // Small element radius
		bubble: "0.75rem", // Standard bubble radius
		bubbleCorner: "0.375rem", // Bubble corner cuts (br-md, tl-md)
	},

	// Border styles that work well
	borders: {
		card: "2px solid", // Main card borders
		content: "1px solid", // Content section borders
		thin: "1px solid", // Thin borders
	},

	// Shadow system extracted from override components
	shadows: {
		card: "0 3px 12px", // Standard card shadow
		badge: "0 2px 8px", // Badge shadow
		bubble: "shadow-lg", // Bubble shadow class
		sm: "shadow-sm", // Small shadow
		md: "shadow-md", // Medium shadow
	},

	// Color mixing patterns for consistent transparency effects
	colorMix: {
		background: "8%", // Standard background mix (8% color + editor background)
		subtleBackground: "5%", // Subtle background mix
		border: "20%", // Border transparency
		shadow: "25%", // Shadow transparency
		badge: "25%", // Badge background transparency
	},

	// Icon and visual element sizes
	icons: {
		standard: "14px", // Standard icon size
		large: "16px", // Large icon size
		badge: "28px", // Badge icon container size
		badgeSmall: "24px", // Small badge icon container
	},

	// Typography hierarchy
	typography: {
		headerTitle: "18px", // Main header title (TaskCompleted)
		subheaderTitle: "16px", // Subheader title (ContextCondense)
		standardTitle: "13px", // Standard title (ApiRequest)
		badge: "13px", // Badge text
		content: "14px", // Main content
		small: "12px", // Small text
	},

	// Theme system for appropriate visual treatment
	themes: {
		celebration: {
			// High-impact styling for special moments like TaskCompleted
			intensity: "high" as const,
			colors: {
				primary: "#10b981", // Rich success green
				accent: "#f59e0b", // Celebration gold
				darkPrimary: "#059669", // Darker green for contrast
			},
			gradients: {
				primary: "linear-gradient(45deg, #10b981, #f59e0b)",
				icon: "linear-gradient(45deg, #10b981, #f59e0b)",
				accent: "linear-gradient(90deg, #059669, #10b981, #059669)",
			},
			shadows: {
				glow: "0 3px 12px color-mix(in srgb, #10b981 25%, transparent)",
				badge: "0 2px 8px color-mix(in srgb, #f59e0b 40%, transparent)",
				icon: "0 2px 8px color-mix(in srgb, #f59e0b 40%, transparent)",
			},
			borders: {
				main: "2px solid #059669",
				accent: "3px", // Top accent line height
			},
			effects: {
				textShadow: "0 1px 2px color-mix(in srgb, #f59e0b 20%, transparent)",
				backgroundMix: "8%", // Background color mixing
			},
		},

		subtle: {
			// Refined, understated styling for system operations like ContextCondense
			intensity: "low" as const,
			colors: {
				primary: "#ec4899", // Refined pink
				accent: "#be185d", // Darker pink for borders
				darkPrimary: "#be185d",
			},
			gradients: {
				primary: "linear-gradient(90deg, #be185d, #ec4899, #be185d)",
				accent: "linear-gradient(90deg, #be185d, #ec4899, #be185d)",
			},
			shadows: {
				glow: "0 2px 8px color-mix(in srgb, #ec4899 15%, transparent)",
				subtle: "0 1px 4px color-mix(in srgb, #ec4899 10%, transparent)",
			},
			borders: {
				main: "1px solid #be185d",
				accent: "2px", // Thinner accent line
			},
			effects: {
				backgroundMix: "5%", // More subtle background mixing
				borderMix: "15%", // Gentler border transparency
			},
		},

		standard: {
			// Normal operation styling
			intensity: "medium" as const,
			colors: {
				primary: "var(--vscode-charts-blue)",
				accent: "var(--vscode-charts-blue)",
				darkPrimary: "var(--vscode-charts-blue)",
			},
			gradients: {
				primary: "none",
			},
			shadows: {
				glow: "0 2px 6px color-mix(in srgb, var(--vscode-charts-blue) 20%, transparent)",
			},
			borders: {
				main: "1px solid var(--vscode-panel-border)",
				accent: "2px",
			},
			effects: {
				backgroundMix: "5%",
			},
		},
	},
} as const

// Semantic-Aware Theme System - Rich styling for each semantic type
export const SEMANTIC_THEMES = {
	thinking: {
		primary: "#f59e0b",
		accent: "#d97706",
		background: "color-mix(in srgb, #f59e0b 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #f59e0b 12%, var(--vscode-editor-background))",
		borderColor: "#f59e0b",
		shadowColor: "color-mix(in srgb, #f59e0b 25%, transparent)",
		iconColor: "#f59e0b",
		textAccent: "#d97706",
	},
	error: {
		primary: "#ef4444",
		accent: "#dc2626",
		background: "color-mix(in srgb, #ef4444 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #ef4444 12%, var(--vscode-editor-background))",
		borderColor: "#ef4444",
		shadowColor: "color-mix(in srgb, #ef4444 25%, transparent)",
		iconColor: "#ef4444",
		textAccent: "#dc2626",
	},
	"file-read": {
		primary: "#06b6d4",
		accent: "#0891b2",
		background: "color-mix(in srgb, #06b6d4 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #06b6d4 12%, var(--vscode-editor-background))",
		borderColor: "#06b6d4",
		shadowColor: "color-mix(in srgb, #06b6d4 25%, transparent)",
		iconColor: "#06b6d4",
		textAccent: "#0891b2",
	},
	"file-write": {
		primary: "#f97316",
		accent: "#ea580c",
		background: "color-mix(in srgb, #f97316 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #f97316 12%, var(--vscode-editor-background))",
		borderColor: "#f97316",
		shadowColor: "color-mix(in srgb, #f97316 25%, transparent)",
		iconColor: "#f97316",
		textAccent: "#ea580c",
	},
	"file-search": {
		primary: "#14b8a6",
		accent: "#0f766e",
		background: "color-mix(in srgb, #14b8a6 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #14b8a6 12%, var(--vscode-editor-background))",
		borderColor: "#14b8a6",
		shadowColor: "color-mix(in srgb, #14b8a6 25%, transparent)",
		iconColor: "#14b8a6",
		textAccent: "#0f766e",
	},
	"codebase-search": {
		primary: "#6366f1",
		accent: "#4f46e5",
		background: "color-mix(in srgb, #6366f1 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #6366f1 12%, var(--vscode-editor-background))",
		borderColor: "#6366f1",
		shadowColor: "color-mix(in srgb, #6366f1 25%, transparent)",
		iconColor: "#6366f1",
		textAccent: "#4f46e5",
	},
	"mode-change": {
		primary: "#8b5cf6",
		accent: "#7c3aed",
		background: "color-mix(in srgb, #8b5cf6 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #8b5cf6 12%, var(--vscode-editor-background))",
		borderColor: "#8b5cf6",
		shadowColor: "color-mix(in srgb, #8b5cf6 25%, transparent)",
		iconColor: "#8b5cf6",
		textAccent: "#7c3aed",
	},
	command: {
		primary: "#6b7280",
		accent: "#4b5563",
		background: "color-mix(in srgb, #6b7280 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #6b7280 12%, var(--vscode-editor-background))",
		borderColor: "#6b7280",
		shadowColor: "color-mix(in srgb, #6b7280 25%, transparent)",
		iconColor: "#6b7280",
		textAccent: "#4b5563",
	},
	completion: {
		primary: "#10b981",
		accent: "#059669",
		background: "color-mix(in srgb, #10b981 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #10b981 12%, var(--vscode-editor-background))",
		borderColor: "#10b981",
		shadowColor: "color-mix(in srgb, #10b981 25%, transparent)",
		iconColor: "#10b981",
		textAccent: "#059669",
	},
	search: {
		primary: "#ec4899",
		accent: "#be185d",
		background: "color-mix(in srgb, #ec4899 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #ec4899 12%, var(--vscode-editor-background))",
		borderColor: "#ec4899",
		shadowColor: "color-mix(in srgb, #ec4899 25%, transparent)",
		iconColor: "#ec4899",
		textAccent: "#be185d",
	},
	"user-input": {
		primary: "#3b82f6",
		accent: "#2563eb",
		background: "color-mix(in srgb, #3b82f6 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #3b82f6 12%, var(--vscode-editor-background))",
		borderColor: "#3b82f6",
		shadowColor: "color-mix(in srgb, #3b82f6 25%, transparent)",
		iconColor: "#3b82f6",
		textAccent: "#2563eb",
	},
	"agent-response": {
		primary: "#10b981",
		accent: "#059669",
		background: "color-mix(in srgb, #10b981 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #10b981 12%, var(--vscode-editor-background))",
		borderColor: "#10b981",
		shadowColor: "color-mix(in srgb, #10b981 25%, transparent)",
		iconColor: "#10b981",
		textAccent: "#059669",
	},
	browser: {
		primary: "#3b82f6",
		accent: "#2563eb",
		background: "color-mix(in srgb, #3b82f6 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #3b82f6 12%, var(--vscode-editor-background))",
		borderColor: "#3b82f6",
		shadowColor: "color-mix(in srgb, #3b82f6 25%, transparent)",
		iconColor: "#3b82f6",
		textAccent: "#2563eb",
	},
	mcp: {
		primary: "#8b5cf6",
		accent: "#7c3aed",
		background: "color-mix(in srgb, #8b5cf6 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #8b5cf6 12%, var(--vscode-editor-background))",
		borderColor: "#8b5cf6",
		shadowColor: "color-mix(in srgb, #8b5cf6 25%, transparent)",
		iconColor: "#8b5cf6",
		textAccent: "#7c3aed",
	},
	api: {
		primary: "#f97316",
		accent: "#ea580c",
		background: "color-mix(in srgb, #f97316 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #f97316 12%, var(--vscode-editor-background))",
		borderColor: "#f97316",
		shadowColor: "color-mix(in srgb, #f97316 25%, transparent)",
		iconColor: "#f97316",
		textAccent: "#ea580c",
	},
	subtask: {
		primary: "#06b6d4",
		accent: "#0891b2",
		background: "color-mix(in srgb, #06b6d4 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #06b6d4 12%, var(--vscode-editor-background))",
		borderColor: "#06b6d4",
		shadowColor: "color-mix(in srgb, #06b6d4 25%, transparent)",
		iconColor: "#06b6d4",
		textAccent: "#0891b2",
	},
	context: {
		primary: "#6b7280",
		accent: "#4b5563",
		background: "color-mix(in srgb, #6b7280 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #6b7280 12%, var(--vscode-editor-background))",
		borderColor: "#6b7280",
		shadowColor: "color-mix(in srgb, #6b7280 25%, transparent)",
		iconColor: "#6b7280",
		textAccent: "#4b5563",
	},
	checkpoint: {
		primary: "#10b981",
		accent: "#059669",
		background: "color-mix(in srgb, #10b981 8%, var(--vscode-editor-background))",
		headerGradient: "color-mix(in srgb, #10b981 12%, var(--vscode-editor-background))",
		borderColor: "#10b981",
		shadowColor: "color-mix(in srgb, #10b981 25%, transparent)",
		iconColor: "#10b981",
		textAccent: "#059669",
	},
} as const

// Helper function to get semantic theme
export const getSemanticTheme = (semantic?: SemanticType) => {
	if (!semantic || !SEMANTIC_THEMES[semantic]) {
		return SEMANTIC_THEMES["context"] // Default to neutral gray theme
	}
	return SEMANTIC_THEMES[semantic]
}

// Enhanced pattern defaults (post-refactor) - Using compact design tokens
export const SIMPLIFIED_PATTERN_DEFAULTS = {
	bubble: {
		classes: "rounded-lg shadow-sm",
		maxWidth: "max-w-[90%]",
		defaultColor: "blue" as const,
		variants: {
			user: "ml-auto rounded-br-md px-3 py-2 mb-1.5",
			agent: "mr-auto rounded-tl-md px-3 py-2 mb-1.5",
			work: "max-w-[95%] rounded-xl shadow-md my-1 overflow-hidden py-1.5 pb-2",
		},
	},
	"status-bar": {
		classes: "rounded px-2 py-1.5 my-0.5 shadow-sm bg-vscode-input-background/30",
		maxWidth: "max-w-full",
		defaultColor: "gray" as const,
	},
} as const

// Context-aware pattern detection
export const detectPatternFromContext = (message: ClineMessage): PatternName => {
	if (message.type === "say" && message.say === "user_feedback") return "bubble"
	if (message.type === "say" && message.say === "text") return "bubble"
	if (message.type === "ask") return "bubble"
	return DEFAULT_STYLE_CONFIG.SAFE_DEFAULTS.pattern
}

// Context-aware color detection
export const detectColorFromContext = (message: ClineMessage): ColorName => {
	if (message.type === "say" && message.say === "user_feedback") return "blue"
	if (message.type === "say" && message.say === "text") return "green"
	if (message.type === "say" && message.say === "error") return "red"
	return DEFAULT_STYLE_CONFIG.SAFE_DEFAULTS.color
}

// Context-aware variant detection
export const detectVariantFromContext = (message: ClineMessage): "user" | "agent" | "work" => {
	if (message.type === "say" && message.say === "user_feedback") return "user"
	if (message.type === "say" && message.say === "text") return "agent"
	return "work"
}

// Enhanced classification with bulletproof defaults
export const getMessageStyleWithDefaults = (
	classification: Partial<MessageStyle>,
	message: ClineMessage,
): MessageStyle => {
	try {
		// Validate and apply defaults if needed
		return {
			type: classification.type || DEFAULT_STYLE_CONFIG.SAFE_DEFAULTS.type,
			pattern: classification.pattern || detectPatternFromContext(message),
			color: classification.color || detectColorFromContext(message),
			variant: classification.variant || detectVariantFromContext(message),
			component: classification.component,
			semantic: classification.semantic,
		}
	} catch (error) {
		// Emergency fallback - guaranteed to work
		console.error("Classification enhancement failed, using safe defaults:", error)
		return {
			type: DEFAULT_STYLE_CONFIG.SAFE_DEFAULTS.type,
			pattern: DEFAULT_STYLE_CONFIG.SAFE_DEFAULTS.pattern,
			color: DEFAULT_STYLE_CONFIG.SAFE_DEFAULTS.color,
			variant: DEFAULT_STYLE_CONFIG.SAFE_DEFAULTS.variant,
		}
	}
}

// Development mode validation
export const validateMessageStyling = (message: ClineMessage, style: MessageStyle) => {
	if (process.env.NODE_ENV === "development") {
		// Warn about potential issues
		if (!style.pattern) console.warn(`No pattern for message:`, message)
		if (!style.color) console.warn(`No color for message:`, message)
		if (style.type === "standard" && !style.pattern) {
			console.error(`Standard message missing pattern:`, message)
		}
	}
}
