import React, { useState } from "react"
import type { SemanticType } from "../../../../theme/chatDefaults"
import { getSemanticTheme } from "../../../../theme/chatDefaults"
import { ScaledText } from "../TypographyInheritance"

/**
 * Smart list renderer for arrays of files, results, or other structured data
 */
export const ListContentRenderer: React.FC<{
	items: any[]
	type: "files" | "results" | "generic"
	semantic?: SemanticType
	maxItems?: number
	expandable?: boolean
}> = ({ items, type, semantic, maxItems = 10, expandable = true }) => {
	const theme = getSemanticTheme(semantic as any)
	const [isExpanded, setIsExpanded] = useState(false)

	// Determine items to display
	const shouldTruncate = expandable && items.length > maxItems
	const displayItems = shouldTruncate && !isExpanded ? items.slice(0, maxItems) : items

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

	// Get type-specific styling for better contrast
	const getItemStyling = () => {
		if (type === "files") {
			return {
				container:
					"flex items-center gap-2 py-1 px-2 border-l-2 border-vscode-panel-border hover:border-vscode-focusBorder transition-colors",
				containerStyle: {
					backgroundColor: "rgba(0, 0, 0, 0.4)",
					borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
				},
				iconColor: "rgba(255, 255, 255, 0.7)",
				textColor: "rgba(255, 255, 255, 0.85)",
				subtextColor: "rgba(255, 255, 255, 0.55)",
			}
		}

		// Default VSCode styling for other types
		return {
			container:
				"flex items-start gap-3 p-2 rounded border border-vscode-panel-border bg-vscode-input-background/30 hover:bg-vscode-input-background/50 transition-colors",
			containerStyle: {},
			iconColor: theme.primary,
			textColor: "var(--vscode-foreground)",
			subtextColor: "var(--vscode-descriptionForeground)",
		}
	}

	const styling = getItemStyling()

	return (
		<div className="space-y-2">
			<div className={type === "files" ? "space-y-0" : "space-y-1"}>
				{displayItems.map((item, index) => (
					<div
						key={index}
						className={styling.container}
						style={{
							...styling.containerStyle,
							...(type === "files" && index < displayItems.length - 1
								? { borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }
								: {}),
						}}>
						<span
							className={`codicon codicon-${getItemIcon(item, index)} text-sm ${type === "files" ? "flex-shrink-0" : "mt-0.5 flex-shrink-0"}`}
							style={{ color: styling.iconColor }}
						/>
						<div className="flex-1 min-w-0">
							<ScaledText
								context="code-inline"
								className="font-medium truncate"
								style={{ color: styling.textColor }}>
								{getItemText(item, index)}
							</ScaledText>
							{getItemSubtext(item) && (
								<ScaledText
									context="metadata"
									className="mt-0.5 font-normal"
									style={{ color: styling.subtextColor }}>
									{getItemSubtext(item)}
								</ScaledText>
							)}
						</div>
						{(item.key || item.path) && (
							<span
								className={`codicon codicon-link-external text-xs cursor-pointer flex-shrink-0 ${type === "files" ? "hover:opacity-100 opacity-50" : "text-vscode-descriptionForeground hover:text-vscode-foreground"}`}
								style={type === "files" ? { color: "rgba(255, 255, 255, 0.6)" } : {}}
							/>
						)}
					</div>
				))}
			</div>

			{/* Expand button when truncated */}
			{shouldTruncate && !isExpanded && (
				<button
					onClick={() => setIsExpanded(true)}
					className="flex items-center gap-2 w-full p-2 text-sm text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-input-background/30 rounded border border-dashed border-vscode-panel-border hover:border-vscode-focusBorder/50 transition-all"
					style={{ borderColor: theme.primary + "40" }}>
					<span className="codicon codicon-chevron-down text-xs" />
					<span>Show all {items.length} items</span>
				</button>
			)}

			{/* Collapse button when expanded */}
			{shouldTruncate && isExpanded && (
				<button
					onClick={() => setIsExpanded(false)}
					className="flex items-center gap-2 w-full p-2 text-sm text-vscode-descriptionForeground hover:text-vscode-foreground hover:bg-vscode-input-background/30 rounded border border-dashed border-vscode-panel-border hover:border-vscode-focusBorder/50 transition-all"
					style={{ borderColor: theme.primary + "40" }}>
					<span className="codicon codicon-chevron-up text-xs" />
					<span>Show less (first {maxItems})</span>
				</button>
			)}
		</div>
	)
}
