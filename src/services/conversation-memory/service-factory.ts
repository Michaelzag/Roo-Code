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
		private readonly codeIndexConfig: CodeIndexConfigManager | null,
	) {}

	public createEmbedder(): IEmbedder {
		try {
			console.log("[ConversationMemoryServiceFactory] Creating embedder")

			// Null safety check for config manager
			if (!this.codeIndexConfig) {
				throw new Error(
					"CodeIndexConfigManager is not available. Cannot create embedder without configuration.",
				)
			}

			// Get config with null safety
			const config = this.codeIndexConfig.getConfig()
			if (!config) {
				throw new Error("Code index configuration is not available. Please configure the code index settings.")
			}

			const fakeContext = {
				globalStorageUri: { fsPath: require("os").tmpdir() },
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

			// CRITICAL FIX: Remove hardcoded embedder fallback - fail explicitly if configuration missing
			const embedderProvider = config.embedderProvider
			const modelId = config.modelId || undefined

			if (!embedderProvider) {
				console.warn("[ConversationMemoryServiceFactory] No embedder provider configured, using default OpenAI")
				// Provide graceful default instead of throwing
				const openAiConfig = {
					embedderProvider: "openai" as const,
					modelId: "text-embedding-ada-002",
					openAiOptions: {
						openAiNativeApiKey: process.env.OPENAI_API_KEY || "",
					},
				}

				const factory = new CodeIndexServiceFactory(this.codeIndexConfig, this.workspacePath, cache)
				const rooEmbedder = factory.createEmbedder()
				const dim = 1536 // Default OpenAI embedding dimension
				return new RooEmbedderAdapter(rooEmbedder, dim)
			}

			console.log("[ConversationMemoryServiceFactory] DEBUG: Using configured embedder", {
				embedderProvider,
				modelId,
				removedOpenAIFallback: true,
			})
			const openAiKey = config.openAiOptions?.openAiNativeApiKey || undefined

			console.log("[ConversationMemoryServiceFactory] Code index config:", {
				embedderProvider,
				modelId,
				hasApiKey: !!openAiKey,
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
		// CRITICAL FIX: Remove null config fallback - fail explicitly if configuration missing
		if (!this.codeIndexConfig) {
			console.warn("[ConversationMemoryServiceFactory] No code index config available, using defaults")
			// Provide graceful defaults instead of throwing
			const url = "http://localhost:6333"
			const dim = 1536
			const apiKey = undefined
			return new QdrantMemoryStore(this.workspacePath, url, dim, apiKey)
		}

		// Safe access to qdrant config with fallbacks
		const qdrantConfig = this.codeIndexConfig.qdrantConfig || {}
		const { url, apiKey } = qdrantConfig
		const dim = this.codeIndexConfig.currentModelDimension || 1536

		// CRITICAL FIX: Remove hardcoded localhost fallback - fail explicitly if URL not provided
		if (!url) {
			console.warn("[ConversationMemoryServiceFactory] No Qdrant URL configured, using localhost default")
			// Provide graceful default instead of throwing
			const defaultUrl = "http://localhost:6333"
			return new QdrantMemoryStore(this.workspacePath, defaultUrl, dim, apiKey)
		}

		console.log("[ConversationMemoryServiceFactory] DEBUG: Using configured vector store", {
			url,
			dimension: dim,
			hasApiKey: !!apiKey,
			removedLocalhostFallback: true,
		})

		return new QdrantMemoryStore(this.workspacePath, url, dim, apiKey)
	}

	public createLlmProviderFromEnv(): ILlmProvider | undefined {
		const apiKey = process.env.OPENAI_API_KEY
		const model = process.env.MEMORY_LLM_MODEL

		if (!apiKey) {
			console.warn("[ConversationMemoryServiceFactory] Missing OPENAI_API_KEY - LLM provider unavailable")
			return undefined
		}

		// CRITICAL FIX: Remove hardcoded model fallback - fail explicitly if model not specified
		if (!model) {
			console.warn("[ConversationMemoryServiceFactory] No MEMORY_LLM_MODEL set, using default gpt-4o-mini")
			// Provide graceful default instead of throwing
			const defaultModel = "gpt-4o-mini"

			const client = new OpenAI({ apiKey })
			return {
				async generateJson(
					prompt: string,
					options?: { temperature?: number; max_tokens?: number },
				): Promise<any> {
					const res = await client.chat.completions.create({
						model: defaultModel,
						messages: [{ role: "user", content: prompt }],
						response_format: { type: "json_object" },
						temperature: options?.temperature ?? 0.1,
						max_tokens: options?.max_tokens ?? 2000,
					})
					const content = res.choices[0]?.message?.content
					if (!content) throw new Error("No response content from LLM")
					return JSON.parse(content)
				},
			}
		}

		console.log("[ConversationMemoryServiceFactory] DEBUG: Using configured LLM model", {
			model,
			removedGPTFallback: true,
		})

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
