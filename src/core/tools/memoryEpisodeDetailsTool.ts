import { Task } from "../task/Task"
import { AskApproval, HandleError, PushToolResult, RemoveClosingTag, ToolUse } from "../../shared/tools"
import { ConversationMemoryManager } from "../../services/conversation-memory/manager"

export async function memoryEpisodeDetailsTool(
	cline: Task,
	block: ToolUse,
	_askApproval: AskApproval,
	handleError: HandleError,
	pushToolResult: PushToolResult,
	removeClosingTag: RemoveClosingTag,
) {
	const toolName = "memory_episode_details"
	try {
		let episodeId: string | undefined = block.params.episode_id
		let limitStr: string | undefined = block.params.limit
		episodeId = removeClosingTag("episode_id", episodeId)
		limitStr = removeClosingTag("limit", limitStr)
		const limit = Math.max(1, Math.min(20, parseInt(limitStr || "5") || 5))

		if (block.partial) return
		if (!episodeId) {
			cline.consecutiveMistakeCount++
			pushToolResult(`Missing required parameter <episode_id> for ${toolName}.`)
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

		const details = await (manager as any).getEpisodeDetails?.(episodeId, limit)
		if (!details) {
			pushToolResult(`No details found for episode ${episodeId}.`)
			return
		}

		const lines: string[] = []
		lines.push(`EPISODE ${episodeId}`)
		if (details.episode_context) lines.push(details.episode_context)
		if (details.timeframe) lines.push(`Timeframe: ${details.timeframe}`)
		lines.push("")
		for (const f of details.facts || []) {
			const flags: string[] = []
			if ((f as any).superseded_by) flags.push("superseded")
			if ((f as any).resolved) flags.push("resolved")
			if ((f as any).metadata?.stale) flags.push("stale")
			const suffix = flags.length ? ` [${flags.join(", ")}]` : ""
			lines.push(`• ${String(f.category || "").toUpperCase()}: ${f.content}${suffix}`)
		}

		pushToolResult(lines.join("\n"))
	} catch (error: any) {
		await handleError(toolName, error)
	}
}
