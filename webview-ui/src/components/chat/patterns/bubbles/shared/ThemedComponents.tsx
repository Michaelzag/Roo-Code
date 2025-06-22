/**
 * Themed Components for Semantic Bubble System
 *
 * Smart components that automatically apply theming based on semantic type
 * and ensure proper content formatting (no raw JSON/Markdown)
 */

import React from "react"
import { cn } from "@/lib/utils"
import { getSemanticTheme, type SemanticType } from "../../../theme/chatDefaults"

// Props for themed components
interface ThemedComponentProps {
	semantic?: SemanticType
	className?: string
	children?: React.ReactNode
}

interface ThemedListProps extends ThemedComponentProps {
	items: string[]
	type?: "bullet" | "numbered"
}

interface ThemedCodeBlockProps extends ThemedComponentProps {
	code: string
	language?: string
	inline?: boolean
}

interface ThemedJsonProps extends ThemedComponentProps {
	data: any
	collapsed?: boolean
}

/**
 * Themed Bubble Header - Automatically gets gradient background with accent text color
 */
export const ThemedBubbleHeader: React.FC<ThemedComponentProps> = ({ semantic, className, children }) => {
	const theme = getSemanticTheme(semantic)

	return (
		<div
			className={cn("px-3 py-2 font-medium text-sm rounded-t-lg", "themed-header", className)}
			style={
				{
					background: theme.headerGradient,
					color: theme.primary,
					"--theme-primary": theme.primary,
					"--theme-accent": theme.accent,
				} as React.CSSProperties
			}>
			{children}
		</div>
	)
}

/**
 * Themed Content Wrapper - Applies semantic background and spacing
 */
export const ThemedContent: React.FC<ThemedComponentProps> = ({ semantic, className, children }) => {
	const theme = getSemanticTheme(semantic)

	return (
		<div
			className={cn("p-4 themed-content", className)}
			style={
				{
					background: theme.background,
					"--theme-primary": theme.primary,
					"--theme-accent": theme.accent,
					"--theme-text-accent": theme.textAccent,
				} as React.CSSProperties
			}>
			{children}
		</div>
	)
}

/**
 * Themed List - Smart list with semantic accent colors
 */
export const ThemedList: React.FC<ThemedListProps> = ({ semantic, items, type = "bullet", className }) => {
	const theme = getSemanticTheme(semantic)
	const ListComponent = type === "numbered" ? "ol" : "ul"

	return (
		<ListComponent
			className={cn(
				"space-y-1 themed-list",
				type === "numbered" ? "list-decimal" : "list-disc",
				"list-inside",
				className,
			)}
			style={
				{
					"--theme-accent": theme.textAccent,
				} as React.CSSProperties
			}>
			{items.map((item, index) => (
				<li key={index} className="text-sm leading-relaxed">
					{item}
				</li>
			))}
		</ListComponent>
	)
}

/**
 * Themed Code Block - Properly formatted code with semantic styling
 */
export const ThemedCodeBlock: React.FC<ThemedCodeBlockProps> = ({
	semantic,
	code,
	language: _language = "text",
	inline = false,
	className,
}) => {
	const theme = getSemanticTheme(semantic)

	if (inline) {
		return (
			<code
				className={cn("px-2 py-1 rounded text-xs font-mono themed-code-inline", className)}
				style={
					{
						background: theme.background,
						color: theme.textAccent,
						border: `1px solid ${theme.borderColor}20`,
					} as React.CSSProperties
				}>
				{code}
			</code>
		)
	}

	return (
		<pre
			className={cn("p-3 rounded-md overflow-x-auto text-xs font-mono themed-code-block", className)}
			style={
				{
					background: theme.background,
					border: `1px solid ${theme.borderColor}30`,
				} as React.CSSProperties
			}>
			<code className="block">{code}</code>
		</pre>
	)
}

/**
 * Themed JSON Display - Properly formatted JSON (never raw)
 */
export const ThemedJson: React.FC<ThemedJsonProps> = ({ semantic, data, collapsed = false, className }) => {
	const theme = getSemanticTheme(semantic)
	const [isCollapsed, setIsCollapsed] = React.useState(collapsed)

	const jsonString = React.useMemo(() => {
		try {
			return JSON.stringify(data, null, 2)
		} catch (error) {
			return `// Invalid JSON data: ${error}`
		}
	}, [data])

	const preview = React.useMemo(() => {
		if (typeof data === "object" && data !== null) {
			const keys = Object.keys(data)
			return `{ ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? ", ..." : ""} }`
		}
		return String(data).slice(0, 50) + (String(data).length > 50 ? "..." : "")
	}, [data])

	return (
		<div
			className={cn("themed-json border rounded-md", className)}
			style={
				{
					borderColor: theme.borderColor + "40",
				} as React.CSSProperties
			}>
			<button
				onClick={() => setIsCollapsed(!isCollapsed)}
				className={cn(
					"w-full flex items-center justify-between p-2 text-left text-xs font-medium",
					"hover:bg-opacity-10 transition-colors",
				)}
				style={
					{
						color: theme.textAccent,
						backgroundColor: theme.background,
					} as React.CSSProperties
				}>
				<span>JSON Data</span>
				<span className={cn("transition-transform", isCollapsed ? "" : "rotate-90")}>▶</span>
			</button>

			{!isCollapsed && (
				<ThemedCodeBlock
					semantic={semantic}
					code={jsonString}
					language="json"
					className="mt-0 rounded-t-none border-t"
				/>
			)}

			{isCollapsed && (
				<div className="px-3 py-2 text-xs font-mono opacity-60" style={{ color: theme.textAccent }}>
					{preview}
				</div>
			)}
		</div>
	)
}

/**
 * Themed Markdown Content - Properly rendered markdown (never raw)
 */
export const ThemedMarkdown: React.FC<ThemedComponentProps & { content: string }> = ({
	semantic,
	content,
	className,
}) => {
	const theme = getSemanticTheme(semantic)

	// Simple markdown-to-HTML conversion for common cases
	const processMarkdown = React.useMemo(() => {
		let processed = content

		// Headers
		processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-base font-semibold mb-2 mt-3">$1</h3>')
		processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-lg font-semibold mb-2 mt-4">$1</h2>')
		processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold mb-3 mt-4">$1</h1>')

		// Bold and italic
		processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>')
		processed = processed.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

		// Inline code
		processed = processed.replace(
			/`([^`]+)`/g,
			'<code class="px-1 py-0.5 rounded text-xs font-mono bg-opacity-20" style="background-color: var(--theme-accent);">$1</code>',
		)

		// Links
		processed = processed.replace(
			/\[([^\]]+)\]\(([^)]+)\)/g,
			'<a href="$2" class="underline hover:opacity-80" style="color: var(--theme-primary);">$1</a>',
		)

		// Line breaks
		processed = processed.replace(/\n\n/g, '</p><p class="mb-2">')
		processed = '<p class="mb-2">' + processed + "</p>"

		return processed
	}, [content])

	return (
		<div
			className={cn("themed-markdown prose prose-sm max-w-none", className)}
			style={
				{
					"--theme-primary": theme.primary,
					"--theme-accent": theme.textAccent,
				} as React.CSSProperties
			}
			dangerouslySetInnerHTML={{ __html: processMarkdown }}
		/>
	)
}

/**
 * Auto-Format Content - Automatically detects and formats JSON/Markdown/Plain text
 */
export const AutoFormattedContent: React.FC<ThemedComponentProps & { content: string | any }> = ({
	semantic,
	content,
	className,
}) => {
	// If it's already an object, format as JSON
	if (typeof content === "object" && content !== null) {
		return <ThemedJson semantic={semantic} data={content} className={className} />
	}

	const stringContent = String(content)

	// Detect if it looks like JSON
	if (stringContent.trim().startsWith("{") || stringContent.trim().startsWith("[")) {
		try {
			const parsed = JSON.parse(stringContent)
			return <ThemedJson semantic={semantic} data={parsed} className={className} />
		} catch {
			// Fall through to markdown/text handling
		}
	}

	// Detect if it contains markdown
	if (
		stringContent.includes("**") ||
		stringContent.includes("##") ||
		stringContent.includes("`") ||
		(stringContent.includes("[") && stringContent.includes("]("))
	) {
		return <ThemedMarkdown semantic={semantic} content={stringContent} className={className} />
	}

	// Plain text with semantic styling
	return <div className={cn("text-sm leading-relaxed", className)}>{stringContent}</div>
}

export default {
	ThemedBubbleHeader,
	ThemedContent,
	ThemedList,
	ThemedCodeBlock,
	ThemedJson,
	ThemedMarkdown,
	AutoFormattedContent,
}
