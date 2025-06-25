import React, { useState } from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../../../theme/chatDefaults"
import type { BubbleContentLimits } from "../../types"
import { BaseContainer } from "../base/BaseContainer"
import { BaseHeader } from "../base/BaseHeader"
import { BaseContent } from "../base/BaseContent"
import { SmartContentRenderer } from "../renderers/SmartContentRenderer"

/**
 * Standard expandable content component
 * Now uses shared base components for consistent styling
 */
export const ExpandableBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	expanded?: boolean
	onToggleExpand?: () => void
	renderContent?: (message: ClineMessage, contentLimits?: BubbleContentLimits) => React.ReactNode
	headerSubtitle?: string
	contentLimits?: BubbleContentLimits
}> = ({
	message,
	classification,
	icon,
	title,
	expanded = true,
	onToggleExpand,
	renderContent,
	headerSubtitle,
	contentLimits,
}) => {
	const [internalExpanded, setInternalExpanded] = useState(expanded)

	const isExpanded = onToggleExpand ? expanded : internalExpanded
	const handleToggle = onToggleExpand || (() => setInternalExpanded(!internalExpanded))

	return (
		<BaseContainer classification={classification}>
			<BaseHeader
				icon={icon}
				title={title}
				subtitle={headerSubtitle}
				expandable
				expanded={isExpanded}
				onToggle={handleToggle}
				classification={classification}
			/>

			{isExpanded && (
				<BaseContent classification={classification}>
					{renderContent ? (
						renderContent(message, contentLimits)
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
