import React from "react"
import type { SemanticType } from "../../../../theme/chatDefaults"
import { getSemanticTheme } from "../../../../theme/chatDefaults"

/**
 * Standard content wrapper for bubbles with semantic background
 */
export const BubbleContentWrapper: React.FC<{
	children: React.ReactNode
	className?: string
	semantic?: SemanticType
}> = ({ children, className = "", semantic }) => {
	const theme = getSemanticTheme(semantic as any)

	return (
		<div
			className={`px-4 pb-4 pt-0 ml-6 bubble-content-wrapper ${className}`}
			style={{
				background: semantic ? theme.background : undefined,
			}}>
			{children}
		</div>
	)
}
