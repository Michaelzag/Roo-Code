import React, { useState, useMemo } from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { TimestampExpandableBubbleContent } from "./shared/layouts/TimestampExpandableBubbleContent"
import { safeJsonParse } from "@roo/safeJsonParse"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { getSemanticTheme } from "../../theme/chatDefaults"
import CodeBlock from "../../../common/CodeBlock"
import type { ExpandableBubbleProps, BubbleContentLimits } from "./types"
import { ScaledText, ScaledScore, ScaledIcon } from "./shared/TypographyInheritance"

interface CodebaseSearchBubbleProps extends ExpandableBubbleProps {
	isLast?: boolean
	isStreaming?: boolean
}

/**
 * Individual Search Result Item - Optimized for performance with proper theming
 */
const SearchResultItem: React.FC<{
	result: any
	index: number
	semantic?: string
}> = React.memo(({ result, index: _index, semantic }) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const theme = getSemanticTheme(semantic as any)

	// Limit code lines to 10 with expansion
	const { limitedCode, totalLines, shouldLimit } = useMemo(() => {
		if (!result.codeChunk) return { limitedCode: "", totalLines: 0, shouldLimit: false }

		const lines = result.codeChunk.split("\n")
		const totalLines = lines.length
		const shouldLimit = totalLines > 10
		const limitedCode = shouldLimit ? lines.slice(0, 10).join("\n") : result.codeChunk

		return { limitedCode, totalLines, shouldLimit }
	}, [result.codeChunk])

	return (
		<div
			className="bg-vscode-input-background border border-vscode-panel-border rounded-md overflow-hidden relative"
			style={{
				background: `linear-gradient(to right,
					var(--vscode-input-background),
					var(--vscode-input-background) ${90 - Math.round(parseFloat(result.score || 0) * 15)}%,
					color-mix(in srgb, var(--vscode-charts-green) 8%, var(--vscode-input-background)) 100%)`,
			}}>
			{/* Subtle relevance indicator as background gradient */}

			{/* File path header - clean and minimal */}
			<div className="flex items-center gap-2 px-3 py-2 border-b border-vscode-panel-border/50 bg-vscode-input-background/70">
				<ScaledIcon className="codicon codicon-file flex-shrink-0 text-vscode-descriptionForeground" />
				<ScaledText context="code-inline" className="text-vscode-foreground truncate flex-1">
					{result.filePath}
				</ScaledText>
				{/* Large, bold relevance score */}
				{result.score && (
					<ScaledScore className="min-w-[50px] py-0.5">
						{Math.round(parseFloat(result.score) * 100)}%
					</ScaledScore>
				)}
			</div>

			{/* Code chunk with integrated line numbers */}
			{result.codeChunk && (
				<div className="p-3">
					{/* Line number indicator above code block */}
					{(result.startLine || result.endLine) && (
						<ScaledText
							context="metadata"
							className="text-vscode-descriptionForeground mb-2"
							weight="medium">
							Lines {result.startLine || 1}-{result.endLine || result.startLine || 1}
							{result.language && ` • ${result.language}`}
							{result.context && ` • ${result.context}`}
						</ScaledText>
					)}

					<div
						className="rounded-md overflow-hidden border relative"
						style={{
							borderColor: theme.borderColor + "30",
						}}>
						<CodeBlock
							source={isExpanded ? result.codeChunk : limitedCode}
							language={result.language || "typescript"}
						/>
					</div>

					{/* Code expansion controls */}
					{shouldLimit && (
						<div
							className="border-t px-3 py-2 mt-3"
							style={{
								borderColor: theme.borderColor + "30",
								backgroundColor: theme.background,
							}}>
							<button
								onClick={() => setIsExpanded(!isExpanded)}
								className="flex items-center gap-2 chat-small-typography text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors"
								style={
									{
										"--hover-color": theme.primary,
									} as React.CSSProperties
								}>
								<span
									className={`codicon ${isExpanded ? "codicon-chevron-up" : "codicon-chevron-down"}`}
								/>
								{isExpanded ? "Show less" : `Show ${totalLines - 10} more lines (${totalLines} total)`}
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	)
})

/**
 * CodebaseSearchContentRenderer - 3-tier content limiting system with proper theming
 */
const CodebaseSearchContentRenderer: React.FC<{
	message: ClineMessage
	contentLimits?: BubbleContentLimits
}> = ({ message, contentLimits: _contentLimits }) => {
	const [showAllItems, setShowAllItems] = useState(false)
	const isResultMessage = (message as any).say === "codebase_search_result"
	const theme = getSemanticTheme("codebase-search")

	if (isResultMessage) {
		// Quick check: must look like JSON before attempting to parse
		const text = message.text?.trim()
		const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

		// Parse search results only if it looks like JSON
		const resultData = isValidJson ? safeJsonParse<any>(message.text, {}) : {}
		const payload = resultData?.content || resultData
		const results = payload?.results || []
		const query = payload?.query || "Unknown query"

		// Tier 2: Item limiting (3 items with expansion)
		const itemLimit = 3
		const visibleResults = showAllItems ? results : results.slice(0, itemLimit)
		const hasMoreItems = results.length > itemLimit

		return (
			<div className="space-y-3">
				<div className="chat-content-typography text-vscode-foreground">
					<span className="font-medium">{results.length} results</span> for &ldquo;{query}&rdquo;
				</div>

				{results.length > 0 ? (
					<>
						{/* Results list */}
						<div className="space-y-2">
							{visibleResults.map((result: any, index: number) => (
								<SearchResultItem
									key={`${result.filePath}-${result.startLine}-${index}`}
									result={result}
									index={index}
									semantic="codebase-search"
								/>
							))}
						</div>

						{/* Item expansion controls with proper theming */}
						{hasMoreItems && (
							<div className="pt-2 border-t" style={{ borderColor: theme.borderColor + "30" }}>
								<button
									onClick={() => setShowAllItems(!showAllItems)}
									className="flex items-center gap-2 w-full p-2 chat-content-typography text-vscode-descriptionForeground hover:text-vscode-foreground rounded border border-dashed transition-all"
									style={{
										borderColor: theme.borderColor + "40",
										backgroundColor: "transparent",
									}}
									onMouseEnter={(e) => {
										e.currentTarget.style.backgroundColor = theme.background
										e.currentTarget.style.borderColor = theme.primary + "50"
									}}
									onMouseLeave={(e) => {
										e.currentTarget.style.backgroundColor = "transparent"
										e.currentTarget.style.borderColor = theme.borderColor + "40"
									}}>
									<span
										className={`codicon ${showAllItems ? "codicon-chevron-up" : "codicon-chevron-down"}`}
									/>
									{showAllItems
										? `Show less (first ${itemLimit} results)`
										: `Show ${results.length - itemLimit} more results (${results.length} total)`}
								</button>
							</div>
						)}
					</>
				) : (
					<div className="chat-content-typography text-vscode-descriptionForeground italic">
						No results found for &ldquo;{query}&rdquo;
					</div>
				)}
			</div>
		)
	}

	// This is the initial codebase_search tool request
	// Quick check: must look like JSON before attempting to parse
	const text = message.text?.trim()
	const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

	const toolData = isValidJson ? safeJsonParse<any>(message.text, {}) : {}
	const query = toolData?.query || toolData?.regex || "Unknown query"
	const path = toolData?.path
	const filePattern = toolData?.file_pattern
	const isOutsideWorkspace = toolData?.isOutsideWorkspace

	return (
		<div className="space-y-3">
			{/* Search Query */}
			<div className="space-y-2">
				<div className="text-sm text-vscode-descriptionForeground font-medium">Query:</div>
				<code className="block bg-vscode-textCodeBlock-background px-3 py-2 rounded text-sm font-mono text-vscode-foreground border border-vscode-panel-border/30">
					{query}
				</code>
			</div>

			{/* Search Scope Information */}
			<div className="bg-vscode-input-background/30 border border-vscode-panel-border/50 rounded-md p-3 space-y-2">
				{/* Workspace/Directory scope */}
				<div className="flex items-center gap-2 text-sm text-vscode-foreground">
					<span
						className={`codicon ${isOutsideWorkspace ? "codicon-link-external" : "codicon-folder"} text-xs flex-shrink-0`}
						style={{ color: isOutsideWorkspace ? theme.accent : theme.primary }}
					/>
					<span className="font-mono">
						{path && path !== "." ? (
							<>
								{isOutsideWorkspace ? "External: " : "Directory: "}
								<span className="font-semibold">{path}</span>
							</>
						) : (
							"Entire workspace"
						)}
					</span>
					{isOutsideWorkspace && (
						<span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
							External
						</span>
					)}
				</div>

				{/* File pattern filter */}
				{filePattern && (
					<div className="flex items-center gap-2 text-sm text-vscode-foreground">
						<span className="codicon codicon-file text-xs text-vscode-descriptionForeground flex-shrink-0" />
						<span className="font-mono">
							Pattern: <span className="font-semibold">{filePattern}</span>
						</span>
					</div>
				)}

				{/* Search type indicator */}
				<div className="flex items-center gap-2 text-xs text-vscode-descriptionForeground pt-1 border-t border-vscode-panel-border/30">
					<span className="codicon codicon-symbol-method" />
					<span>Semantic vector search</span>
				</div>
			</div>
		</div>
	)
}

/**
 * Generate summary for collapsed state with enhanced information
 */
const generateSearchSummary = (message: ClineMessage): string => {
	const isResultMessage = (message as any).say === "codebase_search_result"

	if (isResultMessage) {
		// Quick check: must look like JSON before attempting to parse
		const text = message.text?.trim()
		const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

		const resultData = isValidJson ? safeJsonParse<any>(message.text, {}) : {}
		const payload = resultData?.content || resultData
		const results = payload?.results || []
		const query = payload?.query || "query"

		if (results.length === 0) return `No results for "${query}"`
		if (results.length === 1) return `1 result for "${query}"`
		return `${results.length} results for "${query}"`
	}

	// Enhanced summary for initial search request
	// Quick check: must look like JSON before attempting to parse
	const text = message.text?.trim()
	const isValidJson = text && (text.startsWith("{") || text.startsWith("["))

	const toolData = isValidJson ? safeJsonParse<any>(message.text, {}) : {}
	const query = toolData?.query || toolData?.regex || "query"
	const path = toolData?.path
	const isOutsideWorkspace = toolData?.isOutsideWorkspace

	let summary = `Searching: "${query}"`

	// Add scope information for better context
	if (path && path !== ".") {
		const scopeDesc = isOutsideWorkspace ? "external" : "in"
		summary += ` ${scopeDesc} ${path}`
	} else if (!path || path === ".") {
		summary += " workspace-wide"
	}

	return summary
}

/**
 * CodebaseSearchContent - Tier 1: Bubble-level expansion with summary
 */
const CodebaseSearchContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	contentLimits?: BubbleContentLimits
}> = ({ message, classification, contentLimits }) => {
	// Generate dynamic title with summary when collapsed
	const title = generateSearchSummary(message)

	return (
		<TimestampExpandableBubbleContent
			message={message}
			classification={classification}
			icon="search"
			title={title}
			contentLimits={contentLimits}
			renderContent={(msg, limits) => <CodebaseSearchContentRenderer message={msg} contentLimits={limits} />}
		/>
	)
}

/**
 * CodebaseSearchBubble - Collapsed by default with informative summary, 3-tier content limiting
 */
export const CodebaseSearchBubble: React.FC<CodebaseSearchBubbleProps> = createBubbleComponent<{
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
}>("codebase-search", "pink", {
	maxLines: 100, // High limit since we have item-level limiting
	collapsedByDefault: true, // Collapsed by default with enhanced summary
	previewLines: 2, // Minimal preview when collapsed
})(CodebaseSearchContent)
