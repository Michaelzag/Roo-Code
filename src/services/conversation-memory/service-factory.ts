import { RooEmbedderAdapter } from "./adapters/roo-embedder-adapter"
import { QdrantMemoryStore } from "./storage/qdrant-memory-store"
import type { IEmbedder, ILlmProvider, IVectorStore } from "./interfaces"
import { CodeIndexConfigManager } from "../code-index/config-manager"
import { CodeIndexServiceFactory } from "../code-index/service-factory"
import { CacheManager } from "../code-index/cache-manager"
import * as vscode from "vscode"
import OpenAI from "openai"

export class ConversationMemoryServiceFactory {
	constructor(
		private readonly workspacePath: string,
		private readonly codeIndexConfig: CodeIndexConfigManager,
	) {}

	public createEmbedder(): IEmbedder {
		try {
			console.log("[ConversationMemoryServiceFactory] Creating embedder")
			const fakeContext = {
				globalStorageUri: vscode.Uri.file(require("os").tmpdir()),
				subscriptions: [],
				globalState: {
					get: () => undefined,
					update: () => Promise.resolve(),
					keys: () => [],
					setKeysForSync: () => {},
				},
				workspaceState: {
					get: () => undefined,
					update: () => Promise.resolve(),
					keys: () => [],
				},
			} as unknown as vscode.ExtensionContext
			const cache = new CacheManager(fakeContext, this.workspacePath)
			// No cache.initialize() needed - embedder doesn't require it
			const factory = new CodeIndexServiceFactory(this.codeIndexConfig, this.workspacePath, cache)
			console.log("[ConversationMemoryServiceFactory] Code index config:", {
				embedderProvider: this.codeIndexConfig.getConfig().embedderProvider,
				modelId: this.codeIndexConfig.getConfig().modelId,
				hasApiKey: !!(this.codeIndexConfig.getConfig() as any).openAiOptions?.openAiNativeApiKey,
			})
			const rooEmbedder = factory.createEmbedder()
			const dim = this.codeIndexConfig.currentModelDimension || 1536
			console.log("[ConversationMemoryServiceFactory] Embedder created with dimension:", dim)
			return new RooEmbedderAdapter(rooEmbedder, dim)
		} catch (error) {
			console.error("[ConversationMemoryServiceFactory] Failed to create embedder:", error)
			throw error
		}
	}

	public createVectorStore(): IVectorStore {
		const { url, apiKey } = this.codeIndexConfig.qdrantConfig
		const dim = this.codeIndexConfig.currentModelDimension || 1536
		return new QdrantMemoryStore(this.workspacePath, url || "http://localhost:6333", dim, apiKey)
	}

	public createLlmProviderFromEnv(): ILlmProvider | undefined {
		const apiKey = process.env.OPENAI_API_KEY
		const model = process.env.MEMORY_LLM_MODEL || "gpt-4o-mini"
		if (!apiKey) return undefined
		const client = new OpenAI({ apiKey })
		return {
			async generateJson(prompt: string, options?: { temperature?: number; max_tokens?: number }): Promise<any> {
				const res = await client.chat.completions.create({
					model,
					temperature: options?.temperature ?? 0.2,
					response_format: { type: "json_object" },
					messages: [{ role: "user", content: prompt }],
					max_tokens: options?.max_tokens,
				})
				let content = res.choices?.[0]?.message?.content || "{}"
				content = content
					.trim()
					.replace(/^```(json)?/i, "")
					.replace(/```$/, "")
				try {
					return JSON.parse(content)
				} catch {
					return {}
				}
			},
		}
	}
}
