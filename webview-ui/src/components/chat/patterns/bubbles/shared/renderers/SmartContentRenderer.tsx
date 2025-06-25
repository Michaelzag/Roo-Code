import React, { useMemo, useState } from "react"
import type { ClineMessage } from "@roo-code/types"
import type { SemanticType } from "../../../../theme/chatDefaults"
import type { BubbleContentLimits } from "../../types"
import { getSemanticTheme } from "../../../../theme/chatDefaults"
import { Markdown } from "../../../../Markdown"
import { AutoFormattedContent } from "../ThemedComponents"
import { ListContentRenderer } from "./ListContentRenderer"

/**
 * Universal Text Limiting Component - moved outside to maintain state
 */
const TextLimitingWrapper: React.FC<{
	children: React.ReactNode
	fullText: string
	shouldLimit: boolean
	limitedContent: string | null
	lines: string[]
	hasMarkdown: boolean
	message: ClineMessage
	semantic?: SemanticType
	contentLimits?: BubbleContentLimits
}> = ({ children, fullText, shouldLimit, limitedContent, lines, hasMarkdown, message, semantic, contentLimits }) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const theme = getSemanticTheme(semantic as any)

	if (!shouldLimit) return <>{children}</>

	return (
		<div className="space-y-2">
			{/* Limited or full content */}
			{isExpanded ? (
				hasMarkdown ? (
					<Markdown markdown={fullText} partial={message.partial} />
				) : (
					<AutoFormattedContent semantic={semantic} content={fullText} />
				)
			) : (
				<>
					{hasMarkdown ? (
						<Markdown markdown={limitedContent || ""} partial={false} />
					) : (
						<AutoFormattedContent semantic={semantic} content={limitedContent || ""} />
					)}
					<div className="chat-small-typography text-vscode-descriptionForeground italic">
						... {lines.length - (contentLimits?.previewLines || 5)} more lines
					</div>
				</>
			)}

			{/* Expand/Collapse buttons */}
			{!isExpanded ? (
				<button
					onClick={() => setIsExpanded(true)}
					className="flex items-center gap-2 w-full p-2 chat-content-typography text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-input-background/30 rounded border border-dashed border-vscode-panel-border hover:border-vscode-focusBorder/50 transition-all"
					style={{ borderColor: theme.primary + "40" }}>
					<span className="codicon codicon-chevron-down chat-small-typography" />
					<span>Show all {lines.length} lines</span>
				</button>
			) : (
				<button
					onClick={() => setIsExpanded(false)}
					className="flex items-center gap-2 w-full p-2 chat-content-typography text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-input-background/30 rounded border border-dashed border-vscode-panel-border hover:border-vscode-focusBorder/50 transition-all"
					style={{ borderColor: theme.primary + "40" }}>
					<span className="codicon codicon-chevron-up chat-small-typography" />
					<span>Show less (first {contentLimits?.previewLines || 5} lines)</span>
				</button>
			)}
		</div>
	)
}

/**
 * Universal content renderer with global content limiting
 * Handles all content types: JSON, markdown, plain text with consistent limiting
 */
export const SmartContentRenderer: React.FC<{
	message: ClineMessage
	semantic?: SemanticType
	contentLimits?: BubbleContentLimits
}> = ({ message, semantic, contentLimits }) => {
	const structuredData = useMemo(() => {
		if (!message.text) return null

		// First check if it's JSON
		let parsed: any = null
		try {
			parsed = JSON.parse(message.text) as Record<string, any>
		} catch (_e) {
			// Not JSON, continue with other checks
		}

		if (parsed && typeof parsed === "object") {
			// Detect file operations with batch files (multiple files)
			if (parsed.tool && parsed.batchFiles && Array.isArray(parsed.batchFiles)) {
				return {
					type: "file-list",
					tool: parsed.tool,
					items: parsed.batchFiles,
					isProtected: parsed.isProtected || false,
				}
			}

			// Detect single file operations
			if (parsed.tool && parsed.path && typeof parsed.path === "string") {
				return {
					type: "file-list",
					tool: parsed.tool,
					items: [{ path: parsed.path }],
					isProtected: parsed.isProtected || false,
				}
			}

			// Detect batch diffs (file modifications)
			if (parsed.batchDiffs && Array.isArray(parsed.batchDiffs)) {
				return {
					type: "file-list",
					tool: "editedExistingFile",
					items: parsed.batchDiffs.map((diff: any) => ({
						path: diff.path,
						lineSnippet: `${diff.changeCount || 0} changes`,
						content: diff.content,
					})),
				}
			}

			// Legacy: Detect standalone batch files
			if (parsed.batchFiles && Array.isArray(parsed.batchFiles)) {
				return {
					type: "file-list",
					tool: "readFile",
					items: parsed.batchFiles,
				}
			}

			// Detect search results
			if (parsed.results && Array.isArray(parsed.results)) {
				return {
					type: "list",
					listType: "results",
					items: parsed.results,
					title: `${parsed.results.length} results found`,
				}
			}

			// Generic array detection - look at all levels for any arrays
			const findArrays = (obj: any, depth = 0): Array<[string, any[]]> => {
				if (depth > 2) return [] // Prevent infinite recursion

				const arrays: Array<[string, any[]]> = []

				for (const [key, value] of Object.entries(obj)) {
					if (Array.isArray(value)) {
						arrays.push([key, value])
					} else if (typeof value === "object" && value !== null) {
						arrays.push(...findArrays(value, depth + 1))
					}
				}

				return arrays
			}

			const arrays = findArrays(parsed)
			if (arrays.length > 0) {
				const [arrayKey, arrayValue] = arrays[0]

				// Determine list type based on array content
				let listType: "files" | "results" | "generic" = "generic"
				if (arrayKey.toLowerCase().includes("file") || (arrayValue[0] && arrayValue[0].path)) {
					listType = "files"
				} else if (arrayKey.toLowerCase().includes("result") || (arrayValue[0] && arrayValue[0].lineSnippet)) {
					listType = "results"
				}

				return {
					type: "list",
					listType,
					items: arrayValue,
					title: `${arrayValue.length} ${arrayKey}`,
				}
			}

			return null
		}
	}, [message.text])

	// Universal content limiting for any text content
	const { shouldLimit, lines, limitedContent } = useMemo(() => {
		if (!message.text || !contentLimits?.maxLines) {
			return { shouldLimit: false, lines: [], limitedContent: null }
		}

		const textLines = message.text.split("\n")
		if (textLines.length <= contentLimits.maxLines) {
			return { shouldLimit: false, lines: textLines, limitedContent: null }
		}

		const previewLines = contentLimits.previewLines || Math.min(5, contentLimits.maxLines)
		const limitedText = textLines.slice(0, previewLines).join("\n")

		return {
			shouldLimit: true,
			lines: textLines,
			limitedContent: limitedText,
		}
	}, [message.text, contentLimits?.maxLines, contentLimits?.previewLines])

	// Check if text contains markdown patterns
	const hasMarkdown = useMemo(() => {
		if (!message.text) return false
		const markdownPatterns = [
			/^#{1,6}\s/m, // Headers
			/\*\*.*\*\*/, // Bold
			/\*.*\*/, // Italic
			/`.*`/, // Code
			/```[\s\S]*```/, // Code blocks
			/\[.*\]\(.*\)/, // Links
			/^\s*[-*+]\s/m, // Lists
			/^\s*\d+\.\s/m, // Numbered lists
		]
		return markdownPatterns.some((pattern) => pattern.test(message.text || ""))
	}, [message.text])

	// Render file operations using shared ListContentRenderer (no text limiting needed)
	if (structuredData?.type === "file-list" && structuredData.items) {
		return (
			<ListContentRenderer
				items={structuredData.items}
				type="files"
				semantic={semantic}
				maxItems={contentLimits?.maxItems || 10}
				expandable={true}
			/>
		)
	}

	if (structuredData?.type === "list" && structuredData.items) {
		return (
			<div className="space-y-3">
				{structuredData.title && (
					<div className="text-sm font-medium text-vscode-foreground mb-2">{structuredData.title}</div>
				)}
				<ListContentRenderer
					items={structuredData.items}
					type={structuredData.listType as "files" | "results" | "generic"}
					semantic={semantic}
					maxItems={contentLimits?.maxItems || 10}
					expandable={true}
				/>
			</div>
		)
	}

	// Apply universal content limiting to any text content (markdown or plain)
	if (hasMarkdown) {
		return (
			<TextLimitingWrapper
				fullText={message.text || ""}
				shouldLimit={shouldLimit}
				limitedContent={limitedContent}
				lines={lines}
				hasMarkdown={hasMarkdown}
				message={message}
				semantic={semantic}
				contentLimits={contentLimits}>
				<Markdown markdown={limitedContent || message.text || ""} partial={message.partial} />
			</TextLimitingWrapper>
		)
	}

	// Fallback to auto-formatted content with universal limiting
	return (
		<TextLimitingWrapper
			fullText={message.text || ""}
			shouldLimit={shouldLimit}
			limitedContent={limitedContent}
			lines={lines}
			hasMarkdown={hasMarkdown}
			message={message}
			semantic={semantic}
			contentLimits={contentLimits}>
			<AutoFormattedContent semantic={semantic} content={limitedContent || message.text || ""} />
		</TextLimitingWrapper>
	)
}
