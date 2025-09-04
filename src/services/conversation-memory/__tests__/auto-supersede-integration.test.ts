import { describe, it, expect, vi } from "vitest"
import { ConversationMemoryOrchestrator, handleFilesIndexed } from "../orchestrator"
import { ConversationMemoryStateManager } from "../state-manager"
import type { IEmbedder, IVectorStore } from "../interfaces"
import * as os from "os"
import * as path from "path"

describe("Auto-supersede on delete", () => {
	it("inserts a delete fact and marks existing file refs as superseded", async () => {
		const workspace = path.join(os.tmpdir(), `cmem_${Math.random().toString(36).slice(2)}`)
		const stateManager = new ConversationMemoryStateManager()
		const mockVector: IVectorStore & { updates: any[]; inserts: any[] } = {
			ensureCollection: vi.fn(),
			collectionName: vi.fn(),
			upsert: vi.fn(),
			delete: vi.fn(),
			search: vi.fn(),
			get: vi.fn(),
			insert: vi.fn().mockImplementation(async (_v: number[][], _ids: string[], payloads: any[]) => {
				;(mockVector as any).inserts.push(...payloads)
			}),
			update: vi.fn().mockImplementation(async (_id: string, _vec: any, payload: any) => {
				;(mockVector as any).updates.push(payload)
			}),
			filter: vi.fn().mockResolvedValue([
				{
					id: "r1",
					payload: {
						content: "File changed: a.ts",
						metadata: { file_path: "/a.ts", file_hash: "H1", ref_status: "indexed" },
						workspace_path: workspace,
					},
				},
			]),
			updates: [],
			inserts: [],
		} as any
		const embedder: IEmbedder = {
			embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
			embedBatch: vi.fn(),
			dimension: 3,
		}

		const orch = new ConversationMemoryOrchestrator(workspace, mockVector, embedder, stateManager)
		await orch.start()

		await handleFilesIndexed(orch as any, [{ path: "/a.ts", status: "success", op: "delete" }])

		expect((mockVector as any).inserts.length).toBeGreaterThan(0)
		expect((mockVector as any).updates.length).toBeGreaterThan(0)
		const upd = (mockVector as any).updates[0]
		expect(upd.metadata.stale).toBe(true)
		expect(upd.superseded_by).toBeTruthy()
	})
})
