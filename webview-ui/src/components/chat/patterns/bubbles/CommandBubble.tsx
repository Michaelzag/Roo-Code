import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { SmartContentRenderer } from "./shared/renderers/SmartContentRenderer"
import { COMMAND_OUTPUT_STRING } from "@roo/combineCommandSequences"
import type { ExpandableBubbleProps, BubbleContentLimits } from "./types"
import { ScaledText } from "./shared/TypographyInheritance"

interface CommandBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}

/**
 * Simple parsing function - same approach as the old system
 * Uses COMMAND_OUTPUT_STRING delimiter to split command from output
 */
const parseCommandAndOutput = (text: string | undefined) => {
	if (!text) return { command: "", output: "" }

	const index = text.indexOf(COMMAND_OUTPUT_STRING)

	if (index === -1) {
		return { command: text, output: "" }
	}

	return {
		command: text.slice(0, index).trim(),
		output: text.slice(index + COMMAND_OUTPUT_STRING.length).trim(),
	}
}

/**
 * CommandContentRenderer - Simple, reliable command content renderer
 * Uses universal content limiting from SmartContentRenderer with proper syntax highlighting
 */
const CommandContentRenderer: React.FC<{
	message: ClineMessage
	contentLimits?: BubbleContentLimits
}> = ({ message, contentLimits }) => {
	const { command, output } = parseCommandAndOutput(message.text)

	// Format output as code block for syntax highlighting
	const formattedOutput = output ? `\`\`\`bash\n${output}\n\`\`\`` : "No output"

	// Create a formatted command message for SmartContentRenderer
	const formattedMessage: ClineMessage = {
		...message,
		text: formattedOutput,
	}

	return (
		<div className="bg-vscode-editor-background border border-vscode-widget-border rounded-lg overflow-hidden">
			{/* Terminal Header */}
			<div className="bg-vscode-titleBar-activeBackground px-4 py-2 border-b border-vscode-widget-border">
				<div className="flex items-center space-x-2">
					<ScaledText context="code-inline" className="text-vscode-titleBar-activeForeground">
						{command || "Command executed"}
					</ScaledText>
				</div>
			</div>

			{/* Command Output with Universal Content Limiting and Syntax Highlighting */}
			{output && (
				<div className="p-4">
					<SmartContentRenderer message={formattedMessage} semantic="command" contentLimits={contentLimits} />
				</div>
			)}
		</div>
	)
}

/**
 * CommandContent - Uses shared timestamp-based expandable content
 */
const CommandContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
	contentLimits?: BubbleContentLimits
}> = ({ message, classification, isExpanded, onToggleExpand, contentLimits }) => {
	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="terminal"
			title="Roo executed a command"
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
			contentLimits={contentLimits}
			renderContent={(msg, limits) => <CommandContentRenderer message={msg} contentLimits={limits} />}
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
}>("command", "gray", {
	maxLines: 20, // Limit command output to 20 lines
	collapsedByDefault: false, // Keep expanded by default
	previewLines: 5, // Show 5 lines when collapsed
})(CommandContent)
