import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock vscode for tests
vi.mock("vscode", () => ({
	EventEmitter: vi.fn().mockImplementation(() => ({
		fire: vi.fn(),
		event: vi.fn(),
		dispose: vi.fn(),
	})),
}))

import { ConversationMemoryOrchestrator } from "../orchestrator"
import { ConversationMemoryStateManager } from "../state-manager"
import type { IEmbedder, ILlmProvider, IVectorStore } from "../interfaces"
import * as os from "os"
import * as path from "path"
import * as fs from "fs/promises"

describe("ConversationMemory Turn Processing (Integration-lite)", () => {
	let orchestrator: ConversationMemoryOrchestrator
	let stateManager: ConversationMemoryStateManager
	let mockVectorStore: IVectorStore & { _inserted?: any[] }
	let mockEmbedder: IEmbedder
	let llm: ILlmProvider
	const workspace = path.join(os.tmpdir(), `cmem_${Math.random().toString(36).slice(2)}`)

	beforeEach(async () => {
		await fs.mkdir(workspace, { recursive: true })
		stateManager = new ConversationMemoryStateManager()

		mockVectorStore = {
			ensureCollection: vi.fn().mockResolvedValue(undefined),
			upsert: vi.fn().mockResolvedValue(undefined),
			search: vi.fn().mockResolvedValue([]),
			delete: vi.fn().mockResolvedValue(undefined),
			insert: vi.fn().mockImplementation(async (_vecs: number[][], _ids: string[], payloads: any[]) => {
				if (!mockVectorStore._inserted) mockVectorStore._inserted = []
				mockVectorStore._inserted.push(...payloads)
			}),
			update: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(undefined),
		} as any

		mockEmbedder = {
			embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
			embedBatch: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
			dimension: 3,
		}

		orchestrator = new ConversationMemoryOrchestrator(
			workspace,
			mockVectorStore,
			mockEmbedder,
			stateManager,
			undefined,
		)
		await orchestrator.start()
	})

	it("stores facts for a turn using LLM override", async () => {
		llm = {
			generateJson: vi
				.fn()
				.mockResolvedValue({ facts: [{ content: "Test fact", category: "pattern", confidence: 0.9 }] }),
		}
		const messages = [
			{ role: "user" as const, content: "Please note this pattern" },
			{ role: "assistant" as const, content: "Acknowledged" },
		]
		await orchestrator.processTurn(messages, llm, { modelId: "test-model" })
		expect(mockVectorStore.insert as any).toHaveBeenCalled()
		const payloads = (mockVectorStore as any)._inserted || []
		const hasContent = payloads.some((p: any) => (p?.content || "").includes("Test fact"))
		expect(hasContent).toBe(true)
	})

	it("persists artifact and stores digest fact for MCP tool", async () => {
		llm = {
			generateJson: vi.fn().mockResolvedValue({ facts: [] }),
		}
		const messages = [{ role: "assistant" as const, content: "Using MCP tool" }]
		await orchestrator.processTurn(messages, llm, {
			modelId: "test-model",
			toolMeta: {
				name: "use_mcp_tool",
				params: { server: "db", tool: "sql.query" },
				resultText: '{"rows":[{"id":1}]}',
			},
		})
		const payloads = (mockVectorStore as any)._inserted || []
		const hasDigest = payloads.some((p: any) => (p?.content || "").includes("output captured"))
		expect(hasDigest).toBe(true)
		// Check artifact directory exists
		const artifactDir = path.join(workspace, ".roo-memory", "artifacts")
		const stat = await fs.stat(artifactDir)
		expect(stat.isDirectory()).toBe(true)
	})
})
