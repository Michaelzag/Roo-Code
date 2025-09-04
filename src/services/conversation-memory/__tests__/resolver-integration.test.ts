import { describe, it, expect, vi } from "vitest"
import type { IVectorStore } from "../interfaces"
import { resolveFileRefUpdates } from "../orchestrator"

describe("resolveFileRefUpdates", () => {
	it("marks pending refs as indexed and stale on hash mismatch", async () => {
		const records = [
			{
				id: "1",
				payload: {
					content: "File changed A",
					metadata: { file_path: "/a.ts", file_hash: "AAA", ref_status: "pending" },
					workspace_path: "/ws",
				},
			},
			{
				id: "2",
				payload: {
					content: "File changed A old",
					metadata: { file_path: "/a.ts", code_index_hash: "OLD" },
					workspace_path: "/ws",
				},
			},
		]
		const mockStore: IVectorStore & { updates: any[] } = {
			ensureCollection: vi.fn(),
			collectionName: vi.fn(),
			upsert: vi.fn(),
			insert: vi.fn(),
			update: vi.fn().mockImplementation(async (_id: string, _vec: any, payload: any) => {
				;(mockStore as any).updates.push(payload)
			}),
			delete: vi.fn(),
			get: vi.fn(),
			search: vi.fn(),
			filter: vi.fn().mockResolvedValue(records),
			updates: [],
		} as any

		await resolveFileRefUpdates(mockStore, "/ws", [{ path: "/a.ts", newHash: "BBB", status: "success" }])

		const updates = (mockStore as any).updates
		expect(updates.length).toBeGreaterThan(0)
		const indexed = updates.find((p: any) => p?.metadata?.ref_status === "indexed")
		expect(indexed?.metadata?.code_index_hash).toBe("BBB")
		const stale = updates.find((p: any) => p?.metadata?.stale === true)
		expect(stale).toBeTruthy()
	})
})
