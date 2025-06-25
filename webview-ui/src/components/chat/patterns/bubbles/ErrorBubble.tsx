import React from "react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { ExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { AutoFormattedContent } from "./shared/ThemedComponents"
import { ScaledBadge, ScaledText, ScaledCode } from "./shared/TypographyInheritance"

/**
 * ErrorContent - Intelligent error handling for all error types
 * Automatically detects error type and provides appropriate styling
 * Future-proof: works with any new error types without code changes
 */
const ErrorContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification, expanded, onToggleExpand }) => {
	const { t } = useTranslation()

	// Auto-detect error type and provide appropriate styling
	const errorType = message.say || "error"

	// Configuration for known error types
	const errorConfig: Record<string, { title: string; badge: string; icon: string; maxHeight: string }> = {
		diff_error: {
			title: "Edit Unsuccessful",
			badge: "Diff Error",
			icon: "diff",
			maxHeight: "400px", // More space for diff errors
		},
		rooignore_error: {
			title: "Access Denied",
			badge: "File Protected",
			icon: "lock",
			maxHeight: "300px",
		},
		error: {
			title: t("chat:error"),
			badge: "System Error",
			icon: "warning",
			maxHeight: "300px",
		},
	}

	// Fallback for any future error types - auto-generates user-friendly labels
	const config = errorConfig[errorType] || {
		title: "Error",
		badge: errorType.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
		icon: "warning",
		maxHeight: "300px",
	}

	const renderErrorContent = () => (
		<div className="space-y-3">
			{/* Error Type Badge */}
			<div className="flex items-center gap-2">
				<ScaledBadge variant="error">{config.badge}</ScaledBadge>
				<ScaledText context="micro" className="opacity-60">
					{new Date(message.ts).toLocaleTimeString()}
				</ScaledText>
			</div>

			{/* Formatted Error Content */}
			<ScaledCode
				className="border-l-3 border-red-400"
				style={{
					background: "var(--semantic-background, var(--vscode-textCodeBlock-background))",
					borderColor: "var(--semantic-border-color, #ef4444)",
					color: "var(--vscode-foreground)",
					whiteSpace: "pre-wrap",
					wordBreak: "break-word",
					maxHeight: config.maxHeight,
					overflowY: "auto",
				}}>
				<AutoFormattedContent
					semantic="error"
					content={message.text || `Unknown ${config.badge.toLowerCase()} occurred`}
				/>
			</ScaledCode>
		</div>
	)

	return (
		<ExpandableBubbleContent
			message={message}
			classification={classification}
			icon={config.icon}
			title={config.title}
			expanded={expanded}
			onToggleExpand={onToggleExpand}
			renderContent={renderErrorContent}
		/>
	)
}

/**
 * ErrorBubble - Universal error bubble using factory pattern
 * Handles all current and future error types automatically
 */
export const ErrorBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"error",
	"red",
)(ErrorContent)
