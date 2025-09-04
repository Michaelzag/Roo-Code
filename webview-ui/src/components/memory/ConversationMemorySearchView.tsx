import React, { memo, useCallback } from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Tab, TabContent, TabHeader } from "@src/components/common/Tab"
import { useMemorySearch } from "./useMemorySearch"
import { MemorySearchInput } from "./MemorySearchInput"
import { MemorySearchFilters } from "./MemorySearchFilters"
import { MemorySearchResults } from "./MemorySearchResults"
import { MemoryResult } from "./types"

interface ConversationMemorySearchViewProps {
	onDone?: () => void
}

const ConversationMemorySearchView: React.FC<ConversationMemorySearchViewProps> = ({ onDone }) => {
	const { t } = useAppTranslation()

	const {
		searchQuery,
		setSearchQuery,
		isSearching,
		searchResults,
		searchError,
		filters,
		setFilters,
		handleSearch,
		clearSearch,
		hasQuery,
		resultsCount,
	} = useMemorySearch()

	const handleResultSelect = useCallback((result: MemoryResult) => {
		// Handle memory result selection - could navigate to episode or show details
		console.log("Selected memory result:", result)
		// Future: Navigate to the episode or show memory details
		// For now, just log the selection
	}, [])

	const handleManualSearch = useCallback(() => {
		if (searchQuery.trim()) {
			handleSearch()
		}
	}, [searchQuery, handleSearch])

	return (
		<Tab>
			<TabHeader className="flex flex-col gap-3 p-4">
				{/* Header with title */}
				<div className="flex justify-between items-center">
					<div className="flex items-center gap-2">
						<span className="codicon codicon-search text-lg" />
						<h3 className="text-vscode-foreground m-0 font-semibold">
							{t("memory:search.title", "Search Memories")}
						</h3>
						{hasQuery && resultsCount > 0 && (
							<span className="text-xs text-vscode-descriptionForeground bg-vscode-badge-background text-vscode-badge-foreground px-2 py-1 rounded">
								{resultsCount}
							</span>
						)}
					</div>
					{onDone && (
						<button
							onClick={onDone}
							className="text-xs text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors"
							aria-label={t("common:close", "Close")}>
							<span className="codicon codicon-close text-sm" />
						</button>
					)}
				</div>

				{/* Description */}
				<p className="text-sm text-vscode-descriptionForeground">
					{t(
						"memory:search.description",
						"Search through your conversation memories to find facts, insights, and past discussions.",
					)}
				</p>

				{/* Search Input */}
				<MemorySearchInput
					searchQuery={searchQuery}
					setSearchQuery={setSearchQuery}
					onSearch={handleManualSearch}
					isSearching={isSearching}
				/>

				{/* Search Filters */}
				<MemorySearchFilters filters={filters} setFilters={setFilters} />

				{/* Search Stats */}
				{hasQuery && (
					<div className="flex items-center justify-between text-xs text-vscode-descriptionForeground">
						<div className="flex items-center gap-4">
							<span>
								{t("memory:search.query", "Query")}: &quot;{searchQuery}&quot;
							</span>
							{searchError && (
								<span className="text-vscode-errorForeground">
									{t("memory:search.failed", "Search failed")}
								</span>
							)}
						</div>
						{!isSearching && !searchError && (
							<button
								onClick={clearSearch}
								className="text-vscode-descriptionForeground hover:text-vscode-foreground transition-colors"
								aria-label={t("memory:search.clearSearch", "Clear search")}>
								{t("memory:search.clear", "Clear")}
							</button>
						)}
					</div>
				)}
			</TabHeader>

			{/* Results Content */}
			<TabContent className="px-0 py-0 h-full">
				<MemorySearchResults
					searchResults={searchResults}
					searchQuery={searchQuery}
					isSearching={isSearching}
					searchError={searchError}
					onResultSelect={handleResultSelect}
				/>
			</TabContent>
		</Tab>
	)
}

export default memo(ConversationMemorySearchView)
