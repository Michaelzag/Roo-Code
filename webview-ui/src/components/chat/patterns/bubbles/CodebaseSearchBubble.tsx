import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { safeJsonParse } from "@roo/safeJsonParse"
import { createBubbleComponent } from "./shared/BubbleHelpers"

/**
 * CodebaseSearchContent - Uses shared simple content with proper JSON parsing
 */
const CodebaseSearchContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification }) => {
	// Parse codebase search data from message text
	const searchData = safeJsonParse<any>(message.text, {})

	// Create formatted content following the established pattern
	const formatSearchContent = () => {
		// Extract meaningful search information if available
		const query = searchData?.query || searchData?.search
		const path = searchData?.path
		const results = searchData?.results
		const tool = searchData?.tool

		return (
			<div className="space-y-3">
				{/* Search query */}
				{query && (
					<div className="space-y-1">
						<div className="text-xs opacity-70 font-medium">Query:</div>
						<div className="text-sm font-mono bg-vscode-textCodeBlock-background border border-vscode-panel-border rounded p-2">
							{query}
						</div>
					</div>
				)}

				{/* Search path */}
				{path && (
					<div className="flex items-center gap-2">
						<span className="codicon codicon-folder text-xs opacity-70" />
						<span className="text-sm font-mono">{path}</span>
					</div>
				)}

				{/* Tool used */}
				{tool && (
					<div className="flex items-center gap-2">
						<span className="codicon codicon-tools text-xs opacity-70" />
						<span className="text-sm capitalize">{tool.replace(/_/g, " ")}</span>
					</div>
				)}

				{/* Results count if available */}
				{results && Array.isArray(results) && (
					<div className="flex items-center gap-2">
						<span className="codicon codicon-list-unordered text-xs opacity-70" />
						<span className="text-sm">
							{results.length} result{results.length !== 1 ? "s" : ""} found
						</span>
					</div>
				)}

				{/* Show first few results if available */}
				{results && Array.isArray(results) && results.length > 0 && (
					<div className="space-y-1">
						<div className="text-xs opacity-70 font-medium">Top Results:</div>
						<div className="space-y-1 max-h-32 overflow-auto">
							{results.slice(0, 5).map((result: any, index: number) => (
								<div key={index} className="flex items-start gap-2 text-xs">
									<span className="codicon codicon-file text-xs opacity-70 mt-0.5 flex-shrink-0" />
									<span className="font-mono break-all">
										{result.path || result.file || result.name || `Result ${index + 1}`}
									</span>
								</div>
							))}
							{results.length > 5 && (
								<div className="text-xs opacity-70 italic">...and {results.length - 5} more</div>
							)}
						</div>
					</div>
				)}
			</div>
		)
	}

	return (
		<SimpleBubbleContent
			message={message}
			classification={classification}
			icon="search"
			title="Codebase Search"
			renderContent={formatSearchContent}
		/>
	)
}

/**
 * CodebaseSearchBubble - Uses shared bubble factory with codebase-search semantic
 */
export const CodebaseSearchBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"codebase-search",
	"indigo",
)(CodebaseSearchContent)
