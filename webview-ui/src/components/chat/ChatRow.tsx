import React, { memo, useEffect, useRef } from "react"
import { useSize } from "react-use"
import deepEqual from "fast-deep-equal"

import type { ClineMessage } from "@roo-code/types"

import { useMessageClassification } from "./classification/useMessageClassification"
import { ChatMessage } from "./ChatMessage"

interface ChatRowProps {
	message: ClineMessage
	lastModifiedMessage?: ClineMessage
	isExpanded: boolean
	isLast: boolean
	isStreaming: boolean
	onToggleExpand: (ts: number) => void
	onHeightChange: (isTaller: boolean) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ChatRowContentProps extends Omit<ChatRowProps, "onHeightChange"> {}

const ChatRow = memo(
	(props: ChatRowProps) => {
		const { isLast, onHeightChange, message } = props
		// Store the previous height to compare with the current height
		// This allows us to detect changes without causing re-renders
		const prevHeightRef = useRef(0)

		const { classifyMessage } = useMessageClassification()
		const style = classifyMessage(message)

		// Get appropriate container styling based on message style
		const getContainerClasses = () => {
			if (style.pattern === "bubble") {
				if (style.variant === "user") {
					return "px-[18px] py-[4px] flex justify-end"
				}
				if (style.variant === "agent") {
					return "px-[18px] py-[4px] max-w-[95%]"
				}
				// work variant and other bubble variants get default container
				return "px-[18px] py-[2px]"
			}
			// status-bar and component overrides get default container
			return "px-[18px] py-[2px]"
		}

		const [chatrow, { height }] = useSize(
			<div className={`${getContainerClasses()} pr-[7px] transition-all duration-200`}>
				<ChatRowContent {...props} />
			</div>,
		)

		useEffect(() => {
			// used for partials, command output, etc.
			// NOTE: it's important we don't distinguish between partial or complete here since our scroll effects in chatview need to handle height change during partial -> complete
			const isInitialRender = prevHeightRef.current === 0 // prevents scrolling when new element is added since we already scroll for that
			// height starts off at Infinity
			if (isLast && height !== 0 && height !== Infinity && height !== prevHeightRef.current) {
				if (!isInitialRender) {
					onHeightChange(height > prevHeightRef.current)
				}
				prevHeightRef.current = height
			}
		}, [height, isLast, onHeightChange, message])

		// we cannot return null as virtuoso does not support it, so we use a separate visibleMessages array to filter out messages that should not be rendered
		return chatrow
	},
	// memo does shallow comparison of props, so we need to do deep comparison of arrays/objects whose properties might change
	deepEqual,
)

export default ChatRow

export const ChatRowContent = (props: ChatRowContentProps) => {
	// Simply delegate to our new ChatMessage component
	return <ChatMessage {...props} />
}
