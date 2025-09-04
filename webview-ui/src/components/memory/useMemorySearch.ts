import { useState, useEffect, useCallback, useMemo } from "react"
import { vscode } from "@src/utils/vscode"
import { MemoryResult, MemorySearchFilters } from "./types"

export const useMemorySearch = () => {
	const [searchQuery, setSearchQuery] = useState("")
	const [isSearching, setIsSearching] = useState(false)
	const [searchResults, setSearchResults] = useState<MemoryResult[]>([])
	const [searchError, setSearchError] = useState<string | null>(null)
	const [filters, setFilters] = useState<MemorySearchFilters>({
		timeRange: "all",
		episodeType: "all",
		relevanceThreshold: 0.0,
	})

	// Debounced search - similar to HistoryView pattern
	const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("")

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedSearchQuery(searchQuery)
		}, 300) // 300ms debounce

		return () => clearTimeout(timer)
	}, [searchQuery])

	// Backend message listener - following MemoryPopover pattern
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "conversationMemorySearchResults") {
				setIsSearching(false)
				if (message.values?.success) {
					setSearchError(null)
					setSearchResults(message.values.results || [])
				} else {
					setSearchResults([])
					setSearchError(message.values?.error || "Memory search failed")
				}
			}
		}

		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// Perform search when debounced query or filters change
	const handleSearch = useCallback(() => {
		if (!debouncedSearchQuery.trim()) {
			setSearchResults([])
			setSearchError(null)
			return
		}

		setIsSearching(true)
		setSearchError(null)

		vscode.postMessage({
			type: "conversationMemorySearch",
			query: debouncedSearchQuery,
			memoryFilters: filters,
			limit: 50,
		})
	}, [debouncedSearchQuery, filters])

	// Auto-search when debounced query changes
	useEffect(() => {
		handleSearch()
	}, [handleSearch])

	// Clear search function
	const clearSearch = useCallback(() => {
		setSearchQuery("")
		setSearchResults([])
		setSearchError(null)
	}, [])

	// Filter by time range (skip client-side relevance filtering - let backend handle it)
	const timeFilteredResults = useMemo((): MemoryResult[] => {
		if (filters.timeRange === "all") return searchResults

		const now = new Date()
		const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())

		let cutoffDate: Date
		switch (filters.timeRange) {
			case "today":
				cutoffDate = dayStart
				break
			case "week":
				cutoffDate = new Date(dayStart.getTime() - 7 * 24 * 60 * 60 * 1000)
				break
			case "month":
				cutoffDate = new Date(dayStart.getFullYear(), dayStart.getMonth() - 1, dayStart.getDate())
				break
			default:
				return searchResults
		}

		return searchResults.filter((result) => new Date(result.timestamp) >= cutoffDate)
	}, [searchResults, filters.timeRange])

	// Filter by episode type
	const finalResults = useMemo(() => {
		if (filters.episodeType === "all") return timeFilteredResults

		return timeFilteredResults.filter((result: MemoryResult) => result.episodeType === filters.episodeType)
	}, [timeFilteredResults, filters.episodeType])

	// Sort results by relevance score (highest first)
	const sortedResults = useMemo(() => {
		return [...finalResults].sort((a, b) => b.relevanceScore - a.relevanceScore)
	}, [finalResults])

	return {
		searchQuery,
		setSearchQuery,
		isSearching,
		searchResults: sortedResults,
		searchError,
		filters,
		setFilters,
		handleSearch,
		clearSearch,
		hasQuery: debouncedSearchQuery.trim().length > 0,
		resultsCount: sortedResults.length,
	}
}
