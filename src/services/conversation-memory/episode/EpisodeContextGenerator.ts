import type { IEpisodeContextGenerator, HintsProvider } from "../interfaces/episode"
import type { ILlmProvider } from "../interfaces"
import type { Message, ProjectContext } from "../types"

export class EpisodeContextGenerator implements IEpisodeContextGenerator {
	constructor(
		private readonly llm: ILlmProvider,
		private readonly hintsProvider?: HintsProvider,
	) {}

	async describe(messages: Message[], projectContext?: ProjectContext): Promise<string> {
		const prompt = await this.buildContextPrompt(messages, projectContext)

		try {
			const response = await this.llm.generateJson(prompt, { temperature: 0.2, max_tokens: 80 })
			const text = response?.description || response?.summary || ""
			return text.trim() || `Episode with ${messages.length} messages`
		} catch (error) {
			console.error("[EpisodeContextGenerator] LLM context generation failed:", error)
			// Simple fallback without heuristics - just basic info
			return `Episode with ${messages.length} messages`
		}
	}

	private async buildContextPrompt(messages: Message[], project?: ProjectContext): Promise<string> {
		const convo = messages.map((m) => `${m.role}: ${m.content.substring(0, 300)}`).join("\n")

		// Get dynamic hints for better context
		const hints = await this.getHints(project)
		const hintContext = this.formatHints(hints)

		const projectLine = project
			? `Project: ${project.workspaceName} (${project.language}${project.framework ? "/" + project.framework : ""})`
			: ""

		return `Summarize this technical conversation episode in ≤10 words focusing on the main topic and outcome.
${projectLine}
${hintContext}

Conversation:
${convo}

Return JSON: { "description": "your 10-word summary" }`
	}

	private async getHints(
		project?: ProjectContext,
	): Promise<{ deps?: string[]; tags?: string[]; dirs?: string[]; extra?: string[] }> {
		if (!this.hintsProvider) return {}

		try {
			return await this.hintsProvider.getHints(project)
		} catch (error) {
			console.error("[EpisodeContextGenerator] Failed to get hints:", error)
			return {}
		}
	}

	private formatHints(hints: { deps?: string[]; tags?: string[]; dirs?: string[]; extra?: string[] }): string {
		const parts: string[] = []

		if (hints.deps?.length) {
			parts.push(`Dependencies: ${hints.deps.slice(0, 5).join(", ")}`)
		}
		if (hints.tags?.length) {
			parts.push(`Memory tags: ${hints.tags.slice(0, 5).join(", ")}`)
		}
		if (hints.dirs?.length) {
			parts.push(`Key dirs: ${hints.dirs.slice(0, 5).join(", ")}`)
		}
		if (hints.extra?.length) {
			parts.push(`Keywords: ${hints.extra.slice(0, 3).join(", ")}`)
		}

		return parts.length > 0 ? `Context: ${parts.join("; ")}` : ""
	}
}
