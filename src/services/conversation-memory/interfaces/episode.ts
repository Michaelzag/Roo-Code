import type { Message, ConversationEpisode, ProjectContext, EpisodeConfig } from "../types"

export interface IEpisodeDetector {
	detect(messages: Message[], workspaceId: string, projectContext?: ProjectContext): Promise<ConversationEpisode[]>
}

export interface IEpisodeContextGenerator {
	describe(messages: Message[], projectContext?: ProjectContext): Promise<string>
}

// Pluggable hints provider for LLM context enrichment
export interface HintsProvider {
	getHints(project?: ProjectContext): Promise<{
		deps?: string[] // dependency names inferred from manifests (workspace) or memory tags
		tags?: string[] // tags/components from existing facts (memory)
		dirs?: string[] // salient directory/component names from repo layout
		extra?: string[] // settings-provided keywords
	}>
}
