import React, { useState, useMemo } from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle, SemanticType } from "../../../theme/chatDefaults"
import { getSemanticTheme } from "../../../theme/chatDefaults"
import { Markdown } from "../../../Markdown"
import { AutoFormattedContent } from "./ThemedComponents"
import { safeJsonParse } from "@roo/safeJsonParse"

/**
 * Standard header component for bubbles with semantic styling
 */
export const BubbleHeader: React.FC<{
	icon: string
	title: string
	expandable?: boolean
	expanded?: boolean
	onToggle?: () => void
	subtitle?: string
	classification?: MessageStyle
}> = ({ icon, title, expandable, expanded, onToggle, subtitle, classification }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)

	const headerStyle = classification?.semantic
		? {
				background: semanticTheme.headerGradient,
				color: semanticTheme.primary,
				textShadow: "0 1px 2px rgba(0,0,0,0.1)",
			}
		: {}

	return (
		<div
			className={`flex items-center py-3 px-4 ${expandable ? "cursor-pointer" : ""}`}
			style={headerStyle}
			onClick={expandable ? onToggle : undefined}>
			<span
				className={`codicon codicon-${icon} mr-2 text-sm`}
				style={classification?.semantic ? { color: semanticTheme.primary } : {}}
			/>
			<span className="flex-1 text-sm font-medium truncate">
				{title}
				{subtitle && (
					<span
						className="ml-2 font-normal opacity-90"
						style={
							classification?.semantic
								? { color: semanticTheme.primary }
								: { color: "var(--vscode-foreground)" }
						}>
						{subtitle}
					</span>
				)}
			</span>
			{expandable && (
				<span
					className={`codicon codicon-chevron-${expanded ? "up" : "down"} text-xs opacity-80`}
					style={classification?.semantic ? { color: semanticTheme.primary } : {}}
				/>
			)}
		</div>
	)
}

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

/**
 * Standard expandable content component
 */
export const ExpandableBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	expanded?: boolean
	onToggleExpand?: () => void
	renderContent?: (message: ClineMessage) => React.ReactNode
	headerSubtitle?: string
}> = ({ message, classification, icon, title, expanded = true, onToggleExpand, renderContent, headerSubtitle }) => {
	const [internalExpanded, setInternalExpanded] = useState(expanded)

	const isExpanded = onToggleExpand ? expanded : internalExpanded
	const handleToggle = onToggleExpand || (() => setInternalExpanded(!internalExpanded))

	return (
		<>
			<BubbleHeader
				icon={icon}
				title={title}
				expandable
				expanded={isExpanded}
				onToggle={handleToggle}
				subtitle={headerSubtitle}
				classification={classification}
			/>

			{isExpanded && (
				<BubbleContentWrapper semantic={classification?.semantic}>
					{renderContent ? (
						renderContent(message)
					) : (
						<SmartContentRenderer message={message} semantic={classification?.semantic} />
					)}
				</BubbleContentWrapper>
			)}
		</>
	)
}

/**
 * Smart list renderer for arrays of files, results, or other structured data
 */
export const ListContentRenderer: React.FC<{
	items: any[]
	type: "files" | "results" | "generic"
	semantic?: SemanticType
}> = ({ items, type, semantic }) => {
	const theme = getSemanticTheme(semantic as any)

	const getItemIcon = (_item: any, _index: number) => {
		switch (type) {
			case "files":
				return "file"
			case "results":
				return "search"
			default:
				return "circle-small"
		}
	}

	const getItemText = (item: any, index: number) => {
		if (typeof item === "string") return item
		if (item.path) return item.path
		if (item.name) return item.name
		if (item.label) return item.label
		return `Item ${index + 1}`
	}

	const getItemSubtext = (item: any) => {
		if (item.lineSnippet) return item.lineSnippet
		if (item.content && item.content.length > 100) return `${item.content.substring(0, 100)}...`
		if (item.description) return item.description
		return null
	}

	return (
		<div className="space-y-1">
			{items.map((item, index) => (
				<div
					key={index}
					className="flex items-start gap-3 p-2 rounded border border-vscode-panel-border bg-vscode-input-background/30 hover:bg-vscode-input-background/50 transition-colors">
					<span
						className={`codicon codicon-${getItemIcon(item, index)} text-sm mt-0.5 flex-shrink-0`}
						style={{ color: theme.primary }}
					/>
					<div className="flex-1 min-w-0">
						<div className="text-sm font-medium text-vscode-foreground truncate">
							{getItemText(item, index)}
						</div>
						{getItemSubtext(item) && (
							<div className="text-xs text-vscode-descriptionForeground mt-1 line-clamp-2">
								{getItemSubtext(item)}
							</div>
						)}
					</div>
					{(item.key || item.path) && (
						<span className="codicon codicon-link-external text-xs text-vscode-descriptionForeground hover:text-vscode-foreground cursor-pointer flex-shrink-0" />
					)}
				</div>
			))}
		</div>
	)
}

/**
 * Smart content detector and renderer
 * Automatically detects and renders lists, markdown, and structured data
 */
export const SmartContentRenderer: React.FC<{
	message: ClineMessage
	semantic?: SemanticType
}> = ({ message, semantic }) => {
	const structuredData = useMemo(() => {
		if (!message.text) return null

		try {
			const parsed = safeJsonParse(message.text) as Record<string, any>
			if (!parsed) return null

			// Detect batch files
			if (parsed.batchFiles && Array.isArray(parsed.batchFiles)) {
				return {
					type: "list",
					listType: "files",
					items: parsed.batchFiles,
					title: `${parsed.batchFiles.length} files`,
				}
			}

			// Detect batch diffs
			if (parsed.batchDiffs && Array.isArray(parsed.batchDiffs)) {
				return {
					type: "list",
					listType: "files",
					items: parsed.batchDiffs.map((diff: any) => ({
						path: diff.path,
						lineSnippet: `${diff.changeCount} changes`,
						content: diff.content,
					})),
					title: `${parsed.batchDiffs.length} files modified`,
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
		} catch {
			return null
		}
	}, [message.text])

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

	// Render structured data if detected
	if (structuredData?.type === "list") {
		return (
			<div className="space-y-3">
				{structuredData.title && (
					<div className="text-sm font-medium text-vscode-foreground mb-2">{structuredData.title}</div>
				)}
				<ListContentRenderer
					items={structuredData.items}
					type={structuredData.listType as "files" | "results" | "generic"}
					semantic={semantic}
				/>
			</div>
		)
	}

	// Render markdown if detected
	if (hasMarkdown) {
		return <Markdown markdown={message.text || ""} partial={message.partial} />
	}

	// Fallback to auto-formatted content
	return <AutoFormattedContent semantic={semantic} content={message.text || ""} />
}

/**
 * Smart bubble content component that automatically detects and renders
 * lists, markdown, and structured data appropriately
 */
export const SmartBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	subtitle?: string
	renderContent?: (message: ClineMessage) => React.ReactNode
}> = ({ message, classification, icon, title, subtitle, renderContent }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)

	return (
		<div className="overflow-hidden">
			<div
				className="flex items-center py-3 px-4"
				style={{
					background: semanticTheme.headerGradient,
					color: semanticTheme.primary,
					textShadow: "0 1px 2px rgba(0,0,0,0.1)",
				}}>
				<span className={`codicon codicon-${icon} mr-2 text-sm`} style={{ color: semanticTheme.primary }} />
				<span className="text-sm font-medium flex-1" style={{ color: semanticTheme.primary }}>
					{title}
					{subtitle && (
						<span className="ml-2 font-normal opacity-90" style={{ color: semanticTheme.primary }}>
							{subtitle}
						</span>
					)}
				</span>
			</div>

			<div
				className="p-4 text-sm text-vscode-foreground leading-relaxed"
				style={{
					background: semanticTheme.background,
				}}>
				{renderContent ? (
					renderContent(message)
				) : message.text && message.text.trim() ? (
					<AutoFormattedContent semantic={classification?.semantic} content={message.text} />
				) : (
					<Markdown markdown={message.text || ""} partial={message.partial} />
				)}
			</div>
		</div>
	)
}

/**
 * Smart expandable bubble content with automatic content detection
 */
export const SmartExpandableBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	expanded?: boolean
	onToggleExpand?: () => void
	renderContent?: (message: ClineMessage) => React.ReactNode
	headerSubtitle?: string
}> = ({ message, classification, icon, title, expanded = true, onToggleExpand, renderContent, headerSubtitle }) => {
	const [internalExpanded, setInternalExpanded] = useState(expanded)

	const isExpanded = onToggleExpand ? expanded : internalExpanded
	const handleToggle = onToggleExpand || (() => setInternalExpanded(!internalExpanded))

	return (
		<>
			<BubbleHeader
				icon={icon}
				title={title}
				expandable
				expanded={isExpanded}
				onToggle={handleToggle}
				subtitle={headerSubtitle}
				classification={classification}
			/>

			{isExpanded && (
				<BubbleContentWrapper semantic={classification?.semantic}>
					{renderContent ? (
						renderContent(message)
					) : (
						<SmartContentRenderer message={message} semantic={classification?.semantic} />
					)}
				</BubbleContentWrapper>
			)}
		</>
	)
}

/**
 * Standard simple content component with header and body
 */
export const SimpleBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	renderContent?: (message: ClineMessage) => React.ReactNode
}> = ({ message, classification, icon, title, renderContent }) => {
	const semanticTheme = getSemanticTheme(classification?.semantic)

	return (
		<div className="overflow-hidden">
			<div
				className="flex items-center py-3 px-4"
				style={{
					background: semanticTheme.headerGradient,
					color: semanticTheme.primary,
					textShadow: "0 1px 2px rgba(0,0,0,0.1)",
				}}>
				<span className={`codicon codicon-${icon} mr-2 text-sm`} style={{ color: semanticTheme.primary }} />
				<span className="text-sm font-medium" style={{ color: semanticTheme.primary }}>
					{title}
				</span>
			</div>

			<div
				className="p-4 text-sm text-vscode-foreground leading-relaxed"
				style={{
					background: semanticTheme.background,
				}}>
				{renderContent ? (
					renderContent(message)
				) : message.text && message.text.trim() ? (
					<AutoFormattedContent semantic={classification?.semantic} content={message.text} />
				) : (
					<Markdown markdown={message.text || ""} partial={message.partial} />
				)}
			</div>
		</div>
	)
}

/**
 * Timestamp-based expandable content (for operations that use message.ts)
 */
export const TimestampExpandableBubbleContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	icon: string
	title: string
	isExpanded?: boolean
	onToggleExpand?: (ts: number) => void
	renderContent?: (message: ClineMessage) => React.ReactNode
	headerSubtitle?: string
}> = ({ message, classification, icon, title, isExpanded = true, onToggleExpand, renderContent, headerSubtitle }) => {
	const [internalExpanded, setInternalExpanded] = useState(isExpanded)
	const semanticTheme = getSemanticTheme(classification?.semantic)

	const expanded = isExpanded !== undefined ? isExpanded : internalExpanded
	const toggleExpand = onToggleExpand || (() => setInternalExpanded((prev) => !prev))

	return (
		<div className="overflow-hidden">
			<div
				className="flex items-center cursor-pointer py-3 px-4"
				style={{
					background: semanticTheme.headerGradient,
					color: semanticTheme.primary,
					textShadow: "0 1px 2px rgba(0,0,0,0.1)",
				}}
				onClick={() => toggleExpand(message.ts)}>
				<span className={`codicon codicon-${icon} mr-2 text-sm`} style={{ color: semanticTheme.primary }} />
				<span className="text-sm font-medium flex-1" style={{ color: semanticTheme.primary }}>
					{title}
					{headerSubtitle && (
						<span className="ml-2 font-normal opacity-90" style={{ color: semanticTheme.primary }}>
							{headerSubtitle}
						</span>
					)}
				</span>
				<span
					className={`codicon codicon-chevron-${expanded ? "up" : "down"} text-xs opacity-80`}
					style={{ color: semanticTheme.primary }}
				/>
			</div>

			{expanded && (
				<div className="p-4 text-sm text-vscode-foreground leading-relaxed">
					{renderContent ? (
						renderContent(message)
					) : message.text && message.text.trim() ? (
						<AutoFormattedContent semantic={classification?.semantic} content={message.text} />
					) : (
						<Markdown markdown={message.text || ""} partial={message.partial} />
					)}
				</div>
			)}
		</div>
	)
}
