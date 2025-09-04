import type { IVectorStore } from "../interfaces"
import type { ConversationFact } from "../types"

export class DebugFactRetentionService {
	private timer: NodeJS.Timeout | undefined
	constructor(
		private readonly vectorStore: IVectorStore,
		private readonly workspacePath: string,
		private readonly intervalMinutes: number = 60,
		private readonly resolvedDays: number = 7,
		private readonly staleUnresolvedDays: number = 30,
	) {}

	public start(): void {
		this.stop()
		this.timer = setInterval(
			() => {
				void this.runCleanup().catch(() => {})
			},
			this.intervalMinutes * 60 * 1000,
		)
		// Don't keep process alive
		// @ts-ignore
		if (this.timer?.unref) this.timer.unref()
	}

	public stop(): void {
		if (this.timer) clearInterval(this.timer)
		this.timer = undefined
	}

	public async runCleanup(now = new Date()): Promise<void> {
		if (!this.vectorStore.filter) return
		let cursor: any = undefined
		do {
			const page = await this.vectorStore.filter(
				128,
				{ workspace_path: this.workspacePath, category: "debugging" },
				cursor,
			)
			const records = Array.isArray(page) ? page : page.records
			cursor = Array.isArray(page) ? undefined : (page as any).nextCursor
			for (const r of records) {
				const f = r.payload as ConversationFact
				const ageDays = (now.getTime() - new Date(f.reference_time).getTime()) / (1000 * 60 * 60 * 24)
				if (
					(f.resolved && ageDays > this.resolvedDays) ||
					(!f.resolved && ageDays > this.staleUnresolvedDays)
				) {
					await this.vectorStore.delete(r.id as string)
				}
			}
		} while (cursor)
	}
}
