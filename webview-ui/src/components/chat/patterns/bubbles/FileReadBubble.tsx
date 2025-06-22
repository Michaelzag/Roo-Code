import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import type { ClineSayTool } from "@roo/ExtensionMessage"
import { safeJsonParse } from "@roo/safeJsonParse"
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { AutoFormattedContent, ThemedList } from "./shared/ThemedComponents"

/**
 * FileReadContent - Uses shared timestamp-based expandable content with enhanced formatting
 */
const FileReadContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}> = ({ message, classification, isExpanded, onToggleExpand }) => {
	const tool = safeJsonParse<ClineSayTool>(message.text)

	// Extract file information if available
	const fileName = tool?.path || "Unknown file"
	const fileExtension = fileName.split(".").pop()?.toLowerCase()

	const renderFileContent = () => {
		if (!tool) {
			return <AutoFormattedContent semantic="file-read" content={message.text || ""} />
		}

		const fileInfo = [
			`📄 **File:** ${fileName}`,
			`📁 **Path:** ${tool.path || "Not specified"}`,
			`📝 **Type:** ${fileExtension ? fileExtension.toUpperCase() : "Unknown"} file`,
		]

		return (
			<div className="space-y-3">
				{/* File Info */}
				<div className="flex items-center gap-2 mb-3">
					<span
						className="px-2 py-1 rounded-md text-xs font-semibold"
						style={{
							background: "var(--semantic-accent-color, var(--vscode-charts-cyan))20",
							color: "var(--semantic-text-accent, var(--vscode-foreground))",
							border: "1px solid var(--semantic-border-color, var(--vscode-panel-border))40",
						}}>
						File Read Operation
					</span>
				</div>

				{/* File Details */}
				<ThemedList semantic="file-read" items={fileInfo} className="mb-3" />

				{/* Raw tool data if needed for debugging */}
				{tool && Object.keys(tool).length > 1 && (
					<details className="mt-3">
						<summary className="text-xs opacity-60 cursor-pointer hover:opacity-80">
							Show raw tool data
						</summary>
						<AutoFormattedContent semantic="file-read" content={tool} className="mt-2 text-xs" />
					</details>
				)}
			</div>
		)
	}

	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="file"
			title={`Roo wants to read multiple files:`}
			isExpanded={isExpanded}
			onToggleExpand={onToggleExpand}
			renderContent={renderFileContent}
		/>
	)
}

/**
 * FileReadBubble - Uses shared bubble factory with file-read semantic
 */
export const FileReadBubble = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}>(
	"file-read",
	"cyan",
)(FileReadContent)
