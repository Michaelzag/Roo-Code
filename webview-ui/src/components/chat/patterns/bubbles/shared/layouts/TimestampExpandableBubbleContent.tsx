import React, { useState } from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../../../theme/chatDefaults"
import type { BubbleContentLimits } from "../../types"
import { BaseContainer } from "../base/BaseContainer"
import { BaseHeader } from "../base/BaseHeader"
import { BaseContent } from "../base/BaseContent"
import { SmartContentRenderer } from "../renderers/SmartContentRenderer"

/**
 * Timestamp-based expandable content (for operations that use message.ts)
 * Now uses shared base components for consistent styling and respects content limits
 */
export const TimestampExpandableBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	isExpanded?: boolean
	onToggleExpand?: (ts: number) => void
	renderContent?: (
		message: ClineMessage,
		contentLimits?: BubbleContentLimits,
		isExpanded?: boolean,
	) => React.ReactNode
	headerSubtitle?: string
	contentLimits?: BubbleContentLimits
}> = ({
	message,
	classification,
	icon,
	title,
	isExpanded,
	onToggleExpand,
	renderContent,
	headerSubtitle,
	contentLimits,
}) => {
	// Use contentLimits.collapsedByDefault to determine initial state
	// If explicitly set to false, start expanded (ignore parent isExpanded)
	// If explicitly set to true, start collapsed
	// If undefined, use parent isExpanded or default to true
	const defaultExpanded =
		contentLimits?.collapsedByDefault === true
			? false
			: contentLimits?.collapsedByDefault === false
				? true
				: (isExpanded ?? true)
	const [internalExpanded, setInternalExpanded] = useState(defaultExpanded)

	const expanded = isExpanded !== undefined ? isExpanded : internalExpanded

	const handleToggle = () => {
		if (onToggleExpand) {
			onToggleExpand(message.ts)
		} else {
			setInternalExpanded((prev) => !prev)
		}
	}

	return (
		<BaseContainer classification={classification}>
			<BaseHeader
				icon={icon}
				title={title}
				subtitle={headerSubtitle}
				expandable
				expanded={expanded}
				onToggle={handleToggle}
				classification={classification}
			/>

			{expanded && (
				<BaseContent classification={classification}>
					{renderContent ? (
						renderContent(message, contentLimits, expanded)
					) : (
						<SmartContentRenderer
							message={message}
							semantic={classification?.semantic}
							contentLimits={contentLimits}
						/>
					)}
				</BaseContent>
			)}
		</BaseContainer>
	)
}
