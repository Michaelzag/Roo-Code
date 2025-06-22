import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import type { ExpandableBubbleProps } from "./types"
import { safeJsonParse } from "@roo/safeJsonParse"
import { ThemedCodeBlock } from "./shared/ThemedComponents"

interface CommandBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

/**
 * CommandContent - Uses shared timestamp-based expandable content with enhanced command formatting
 */
const CommandContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}> = ({ message, classification, isExpanded, onToggleExpand }) => {
	const renderCommandContent = () => {
		const commandData = safeJsonParse(message.text) as any
		const command = commandData?.command || message.text || "Unknown command"

		return (
			<div className="space-y-3">
				{/* Command Badge */}
				<div className="flex items-center gap-2 mb-3">
					<span
						className="px-2 py-1 rounded-md text-xs font-semibold"
						style={{
							background: "var(--semantic-accent-color, var(--vscode-charts-gray))20",
							color: "var(--semantic-text-accent, var(--vscode-foreground))",
							border: "1px solid var(--semantic-border-color, var(--vscode-panel-border))40",
						}}>
						🖥️ Terminal Command
					</span>
				</div>

				{/* Command Code Block */}
				<ThemedCodeBlock semantic="command" code={command} language="bash" className="font-mono" />
			</div>
		)
	}

	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="terminal"
			title="Command"
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
			renderContent={renderCommandContent}
		/>
	)
}

/**
 * CommandBubble - Uses shared bubble factory with command semantic
 */
export const CommandBubble: React.FC<CommandBubbleProps> = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}>(
	"command",
	"gray",
)(CommandContent)
