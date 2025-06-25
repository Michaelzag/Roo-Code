import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/layouts/TimestampExpandableBubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { SmartContentRenderer } from "./shared/renderers/SmartContentRenderer"
import { getSemanticTheme } from "../../theme/chatDefaults"
import type { ExpandableBubbleProps, BubbleContentLimits } from "./types"

interface ThinkingBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
}

/**
 * ThinkingContentRenderer - Respects BaseContent padding system
 */
const ThinkingContentRenderer: React.FC<{
	message: ClineMessage
	contentLimits?: BubbleContentLimits
}> = ({ message, contentLimits }) => {
	const [showAllContent, setShowAllContent] = useState(false)
	const scrollRef = useRef<HTMLDivElement>(null)
	const _theme = getSemanticTheme("thinking")

	// Calculate sliding window content
	const lines = (message.text || "").split("\n")
	const totalLines = lines.length
	const maxVisibleLines = 10
	const hasHiddenContent = totalLines > maxVisibleLines

	// Create display message for SmartContentRenderer
	const getDisplayContent = () => {
		if (showAllContent) {
			return message.text // Show everything
		} else if (hasHiddenContent) {
			// Show last 10 lines (sliding window)
			return lines.slice(-maxVisibleLines).join("\n")
		} else {
			return message.text // Show all if less than 10 lines
		}
	}

	const displayMessage: ClineMessage = {
		...message,
		text: getDisplayContent(),
	}

	// Auto-scroll during streaming (only when in sliding window mode)
	useEffect(() => {
		if (scrollRef.current && message.partial && !showAllContent) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight
		}
	}, [message.text, message.partial, showAllContent])

	return (
		<div className="space-y-3">
			{/* Toggle button - works within BaseContent's padding */}
			{hasHiddenContent && (
				<button
					onClick={() => setShowAllContent(!showAllContent)}
					className="flex items-center gap-2 w-full p-2 text-sm text-vscode-descriptionForeground hover:text-vscode-foreground rounded border border-dashed border-vscode-panel-border/40 hover:border-vscode-focusBorder/50 transition-all bg-transparent hover:bg-vscode-input-background">
					<span className={`codicon ${showAllContent ? "codicon-chevron-down" : "codicon-chevron-up"}`} />
					{showAllContent
						? `Show sliding window (last ${maxVisibleLines} lines)`
						: `Show ${totalLines - maxVisibleLines} more lines above (${totalLines} total)`}
				</button>
			)}

			{/* Content area - add proper padding like other bubbles */}
			{showAllContent ? (
				<div className="px-3 py-2">
					<SmartContentRenderer message={displayMessage} semantic="thinking" contentLimits={contentLimits} />
				</div>
			) : (
				<div
					ref={scrollRef}
					className="overflow-auto px-3 py-2"
					style={{
						maxHeight: "240px",
						scrollBehavior: "smooth",
					}}>
					<SmartContentRenderer message={displayMessage} semantic="thinking" contentLimits={contentLimits} />
				</div>
			)}
		</div>
	)
}

/**
 * ThinkingContent - Uses TimestampExpandableBubbleContent for header expand/collapse
 */
const ThinkingContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	contentLimits?: BubbleContentLimits
}> = ({ message, classification, contentLimits }) => {
	const { t } = useTranslation()

	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="lightbulb"
			title={t("chat:reasoning.thinking")}
			contentLimits={contentLimits}
			renderContent={(msg, limits) => <ThinkingContentRenderer message={msg} contentLimits={limits} />}
		/>
	)
}

/**
 * ThinkingBubble - Green themed, expandable by default, with auto-scroll and expansion
 */
export const ThinkingBubble: React.FC<ThinkingBubbleProps> = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
}>("thinking", "green", {
	maxLines: 100, // High limit since we have internal limiting
	collapsedByDefault: false, // Expanded by default
	previewLines: 5, // When collapsed via header
})(ThinkingContent)
