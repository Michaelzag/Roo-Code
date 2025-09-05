import * as vscode from "vscode"
import { Task } from "../task/Task"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import { formatResponse } from "../prompts/responses"
import { ConversationMemoryManager } from "../../services/conversation-memory/manager"

export async function memorySearchTool(
	cline: Task,
	block: ToolUse,
	askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const toolName = "memory_search"
	try {
		// Params
		let query: string | undefined = block.params.query
		query = removeClosingTag("query", query)

		if (block.partial) {
			await cline.ask("tool", JSON.stringify({ tool: "memorySearch", query }), block.partial).catch(() => {})
			return
		}

		if (!query) {
			cline.consecutiveMistakeCount++
			pushToolResult(await cline.sayAndCreateMissingParamError(toolName, "query"))
			return
		}

		const workspacePath = cline.cwd && cline.cwd.trim() !== "" ? cline.cwd : undefined
		const context = cline.providerRef.deref()?.context
		if (!context) throw new Error("Extension context is not available.")

		const manager = ConversationMemoryManager.getInstance(context, workspacePath)
		if (!manager || !manager.isFeatureEnabled) {
			pushToolResult("Conversation memory feature is disabled or unavailable for this workspace.")
			return
		}

		// Memory search is auto-approved when enabled (like codebase search)

		// Send memory operation notification for search started
		const provider = cline.providerRef.deref()
		if (provider) {
			await provider.postMessageToWebview({
				type: "conversationMemoryOperation",
				payload: {
					operation: "search",
					status: "started",
					message: `Searching for: ${query}`,
				} as any,
			})
		}

		// Try episode search first, fall back to individual facts
		const episodeResults = await manager.searchEpisodes(query, 3)
		let hasEpisodeResults = episodeResults && episodeResults.length > 0

		let results: any[] = []
		if (hasEpisodeResults) {
			results = episodeResults
		} else {
			results = await manager.searchMemory(query)
		}

		// Send memory operation notification for search completed
		if (provider) {
			await provider.postMessageToWebview({
				type: "conversationMemoryOperation",
				payload: {
					operation: "search",
					status: "completed",
					message: `Found ${results?.length || 0} ${hasEpisodeResults ? "episodes" : "memories"}`,
					resultCount: results?.length || 0,
				} as any,
			})
		}

		if (!results || results.length === 0) {
			pushToolResult(`No relevant memory found for query: "${query}"`)
			return
		}

		// Optional: validate up to 2 stale facts via compact LLM check
		const staleToValidate = results.filter((f: any) => f?.metadata?.stale).slice(0, 2)
		const validations: Record<string, { valid: boolean; reason?: string }> = {}
		if (staleToValidate.length && cline.api) {
			for (const f of staleToValidate) {
				try {
					const prompt = `You are validating whether a stale memory is still useful context. Return JSON only.
Fact: ${f.content}
Category: ${f.category}
Metadata: ${JSON.stringify(f.metadata || {})}
Answer with {"valid": true|false, "reason": "short"}.`
					const stream = cline.api.createMessage("Return a single JSON object. No prose.", [
						{ role: "user", content: prompt },
					])
					let txt = ""
					for await (const chunk of stream) {
						if (chunk.type === "text") txt += chunk.text
					}
					try {
						const obj = JSON.parse(
							txt
								.trim()
								.replace(/^```(?:json)?/i, "")
								.replace(/```$/, ""),
						)
						if (typeof obj?.valid === "boolean")
							validations[f.id || f.content] = { valid: obj.valid, reason: obj.reason }
					} catch {}
				} catch {}
			}
		}

		let formatted: string

		if (hasEpisodeResults) {
			// Format episode results
			formatted = results
				.map((episode: any) => {
					const facts = episode.facts || []
					const factSummary = facts
						.slice(0, 3)
						.map((f: any) => `  • ${f.category.toUpperCase()}: ${f.content}`)
						.join("\n")

					const moreFactsNote = facts.length > 3 ? `\n  • ... and ${facts.length - 3} more facts` : ""

					return `EPISODE: ${episode.episode_context} (${episode.timeframe})
ID: ${episode.episode_id}
Score: ${episode.relevance_score.toFixed(2)} | ${episode.fact_count} facts
${factSummary}${moreFactsNote}`
				})
				.join("\n\n")
		} else {
			// Format individual fact results (existing logic)
			formatted = results
				.map((f) => {
					const date = new Date(f.reference_time).toISOString().slice(0, 10)
					const flags: string[] = []
					if (f.superseded_by) flags.push("superseded")
					if (f.resolved) flags.push("resolved")
					if (f.derived_from) flags.push("derived")
					if ((f as any)?.metadata?.stale) flags.push("stale")
					const val = validations[(f as any).id || f.content]
					if (val) flags.push(val.valid ? "validated" : "obsolete")
					const suffix = flags.length ? ` [${flags.join(", ")}]` : ""
					const valNote = val?.reason ? ` — ${val.reason}` : ""
					return `${f.category.toUpperCase()}: ${f.content} (${date})${suffix}${valNote}`
				})
				.join("\n\n")
		}

		const resultType = hasEpisodeResults ? "episodes" : "memories"
		pushToolResult(`Found ${results.length} ${resultType}:\n\n${formatted}`)
	} catch (error: any) {
		await handleError(toolName, error)
	}
}
