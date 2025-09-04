export interface MemoryResult {
	id: string
	title: string
	content: string
	timestamp: Date
	episodeType: "conversation" | "fact" | "insight"
	relevanceScore: number
	episodeId: string
	metadata?: Record<string, any>
}

export interface MemorySearchFilters {
	timeRange: "all" | "today" | "week" | "month"
	episodeType: "all" | "conversation" | "fact" | "insight"
	relevanceThreshold: number
}

export interface MemorySearchResponse {
	success: boolean
	results?: MemoryResult[]
	error?: string
}

export interface MemorySearchItemProps {
	result: MemoryResult
	searchQuery: string
	onSelect: (result: MemoryResult) => void
}

export interface MemorySearchInputProps {
	searchQuery: string
	setSearchQuery: (query: string) => void
	onSearch: () => void
	isSearching: boolean
}

export interface MemorySearchFiltersProps {
	filters: MemorySearchFilters
	setFilters: (filters: MemorySearchFilters) => void
}

export interface MemorySearchResultsProps {
	searchResults: MemoryResult[]
	searchQuery: string
	isSearching: boolean
	searchError: string | null
	onResultSelect: (result: MemoryResult) => void
}
