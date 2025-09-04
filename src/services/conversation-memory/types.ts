// Conversation Memory core types (isolated from Code Index types)
export type FactCategory = "infrastructure" | "architecture" | "debugging" | "pattern"

export interface Message {
	role: "user" | "assistant" | "system"
	content: string
	timestamp?: string // ISO
}

export interface ConversationEpisode {
	episode_id: string
	messages: Message[]
	reference_time: Date
	workspace_id: string
	workspace_path?: string
	context_description: string
	start_time: Date
	end_time: Date
	message_count: number
}

export interface ProjectContext {
	workspaceName: string
	language: string
	framework?: string
	packageManager?: string
}

export interface ConversationFact {
	id: string
	content: string
	category: FactCategory
	confidence: number
	reference_time: Date
	ingestion_time: Date
	workspace_id: string
	workspace_path?: string
	project_context: ProjectContext
	conversation_context: string
	episode_id?: string
	episode_context?: string
	embedding: number[]
	metadata: Record<string, any>
	superseded_by?: string
	superseded_at?: Date
	resolved?: boolean
	resolved_at?: Date
	derived_from?: string
	derived_pattern_created?: boolean
	last_confirmed?: Date
	source_model?: string
}

export interface CategorizedFactInput {
	content: string
	category: FactCategory
	confidence: number
	embedding?: number[]
	reference_time?: Date
	context_description?: string
	episode_id?: string
	episode_context?: string
	source_model?: string
	metadata?: Record<string, any>
}

export type MemoryActionType = "ADD" | "UPDATE" | "SUPERSEDE" | "DELETE_EXISTING" | "IGNORE"

export interface MemoryAction {
	type: MemoryActionType
	fact: CategorizedFactInput
	target_ids?: string[]
	reasoning?: string
}

export interface SearchOptions {
	limit?: number
	filters?: Partial<{
		category: FactCategory
		resolved: boolean
		after: Date
		before: Date
		episode_id: string
	}>
}

// Episode system types (per doc 15)
export type SegmentationMode = "heuristic" | "semantic" | "llm_verified"

export interface EpisodeConfig {
	timeGapMin?: number // default 30
	maxMessages?: number // default 25
	topicPatterns?: string[] // workspace-configured, optional
	segmentation?: {
		mode?: SegmentationMode // default 'semantic'
		semantic?: {
			driftK?: number // MAD multiplier, default 2.5
			minWindow?: number // min messages to stabilize centroid, default 5
			distance?: "cosine" | "dot" // default 'cosine'
		}
		boundaryRefiner?: boolean // default true when mode === 'llm_verified'
	}
	context?: {
		preferLLM?: boolean // default true
		hints?: {
			source?: "none" | "workspace" | "memory" | "auto" // default 'auto'
			extra?: string[] // optional explicit keywords from settings
		}
	}
}

export interface EpisodeSearchResult {
	episode_id: string
	episode_context: string
	relevance_score: number
	fact_count: number
	facts: ConversationFact[]
	timeframe: string
}
