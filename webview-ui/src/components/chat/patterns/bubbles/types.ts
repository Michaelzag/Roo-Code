import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"

/**
 * Standard base props for all bubble components
 * Following the documented bubble pattern architecture
 */
export interface BaseBubbleProps {
	message: ClineMessage
	classification?: MessageStyle
	children?: React.ReactNode
	className?: string
}

/**
 * Props for bubbles that support expansion/collapse
 */
export interface ExpandableBubbleProps extends BaseBubbleProps {
	isExpanded?: boolean
	onToggleExpand?: (ts: number) => void
}

/**
 * Props for bubbles that handle streaming operations
 */
export interface StreamingBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
}

/**
 * Props for bubbles that handle file operations
 */
export interface FileBubbleProps extends StreamingBubbleProps {
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}

/**
 * Props for bubbles that handle interactive suggestions
 */
export interface InteractiveBubbleProps extends BaseBubbleProps {
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

/**
 * Props for simple expandable bubbles (no timestamp needed)
 */
export interface SimpleExpandableBubbleProps extends BaseBubbleProps {
	expanded?: boolean
	onToggleExpand?: () => void
}
