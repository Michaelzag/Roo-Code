import React from "react"
import { Virtuoso } from "react-virtuoso"
import { VSCodeProgressRing } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { MemorySearchResultsProps } from "./types"
import { MemorySearchItem } from "./MemorySearchItem"

export const MemorySearchResults: React.FC<MemorySearchResultsProps> = ({
	searchResults,
	searchQuery,
	isSearching,
	searchError,
	onResultSelect,
}) => {
	const { t } = useAppTranslation()

	// Loading state
	if (isSearching) {
		return (
			<div className="flex flex-col items-center justify-center py-8 gap-3">
				<VSCodeProgressRing className="size-6" />
				<div className="flex items-center gap-2 text-sm text-vscode-descriptionForeground">
					{t("memory:search.searching", { defaultValue: "Searching memories..." })}
				</div>
			</div>
		)
	}

	// Error state
	if (searchError) {
		return (
			<div className="flex flex-col items-center justify-center py-8 gap-3">
				<div className="flex items-center gap-2 text-sm text-vscode-errorForeground">
					<span className="codicon codicon-error text-base" />
					{searchError}
				</div>
				<p className="text-xs text-vscode-descriptionForeground text-center max-w-md">
					{t("memory:search.errorHint", { defaultValue: "Try adjusting your search query or filters" })}
				</p>
			</div>
		)
	}

	// Empty state - no search query
	if (!searchQuery.trim()) {
		return (
			<div className="flex flex-col items-center justify-center py-12 gap-3">
				<div className="flex items-center gap-2 text-vscode-descriptionForeground mb-2">
					<span className="codicon codicon-search text-2xl opacity-50" />
				</div>
				<p className="text-sm text-vscode-descriptionForeground text-center">
					{t("memory:search.emptyQuery", { defaultValue: "Enter a search query to find memories" })}
				</p>
				<p className="text-xs text-vscode-descriptionForeground opacity-70 text-center max-w-md">
					{t("memory:search.searchHint", {
						defaultValue: "Search for conversations, facts, or insights from your previous interactions",
					})}
				</p>
			</div>
		)
	}

	// No results found
	if (searchResults.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-12 gap-3">
				<div className="flex items-center gap-2 text-vscode-descriptionForeground mb-2">
					<span className="codicon codicon-search-stop text-2xl opacity-50" />
				</div>
				<p className="text-sm text-vscode-descriptionForeground text-center">
					{t("memory:search.noResults", { defaultValue: "No memories found" })}
				</p>
				<p className="text-xs text-vscode-descriptionForeground opacity-70 text-center max-w-md">
					{t("memory:search.noResultsHint", {
						defaultValue: "Try different keywords or adjust your filters to broaden the search",
					})}
				</p>
			</div>
		)
	}

	// Results found - render with Virtuoso for performance
	return (
		<div className="flex flex-col h-full">
			{/* Results header */}
			<div className="px-3 py-2 border-b border-vscode-panel-border bg-vscode-editor-background sticky top-0 z-10">
				<div className="flex items-center justify-between">
					<p className="text-sm text-vscode-foreground">
						{t("memory:search.resultsCount", {
							defaultValue: "{{count}} memories found",
							count: searchResults.length,
						})}
					</p>
					<p className="text-xs text-vscode-descriptionForeground">
						{t("memory:search.sortedByRelevance", { defaultValue: "Sorted by relevance" })}
					</p>
				</div>
			</div>

			{/* Virtualized results list */}
			<Virtuoso
				style={{ height: "100%" }}
				data={searchResults}
				data-testid="memory-search-results"
				initialTopMostItemIndex={0}
				components={{
					List: React.forwardRef((props, ref) => (
						<div {...props} ref={ref} data-testid="memory-search-results-list" />
					)),
				}}
				itemContent={(_index, result) => (
					<MemorySearchItem
						key={result.id}
						result={result}
						searchQuery={searchQuery}
						onSelect={onResultSelect}
					/>
				)}
			/>
		</div>
	)
}
