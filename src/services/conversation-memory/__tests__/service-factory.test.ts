import type { MockedClass } from "vitest"
import { ConversationMemoryServiceFactory } from "../service-factory"
import { RooEmbedderAdapter } from "../adapters/roo-embedder-adapter"
import { QdrantMemoryStore } from "../storage/qdrant-memory-store"
import { CodeIndexServiceFactory } from "../../code-index/service-factory"
import { CacheManager } from "../../code-index/cache-manager"

// Mock dependencies following established pattern
vi.mock("../adapters/roo-embedder-adapter")
vi.mock("../storage/qdrant-memory-store")
vi.mock("../../code-index/service-factory")
vi.mock("../../code-index/cache-manager")

// Mock VSCode API
vi.mock("vscode", () => ({
	Uri: {
		file: vi.fn((path: string) => ({ fsPath: path })),
	},
}))

// Mock os module
vi.mock("os", () => ({
	tmpdir: vi.fn(() => "/tmp"),
}))

// Mock OpenAI module
vi.mock("openai", () => ({
	default: vi.fn(),
}))

const MockedRooEmbedderAdapter = RooEmbedderAdapter as MockedClass<typeof RooEmbedderAdapter>
const MockedQdrantMemoryStore = QdrantMemoryStore as MockedClass<typeof QdrantMemoryStore>
const MockedCodeIndexServiceFactory = CodeIndexServiceFactory as MockedClass<typeof CodeIndexServiceFactory>
const MockedCacheManager = CacheManager as MockedClass<typeof CacheManager>

/**
 * Tests for ConversationMemoryServiceFactory following established Roo-Code patterns.
 * Models the testing approach used by code-index/service-factory.spec.ts
 */
describe("ConversationMemoryServiceFactory", () => {
	let factory: ConversationMemoryServiceFactory
	let mockCodeIndexConfig: any
	const testWorkspacePath = "/test/workspace"

	beforeEach(() => {
		vi.clearAllMocks()

		mockCodeIndexConfig = {
			getConfig: vi.fn(),
			qdrantConfig: {
				url: "http://localhost:6333",
				apiKey: "test-qdrant-key",
			},
			currentModelDimension: 1536,
		}

		factory = new ConversationMemoryServiceFactory(testWorkspacePath, mockCodeIndexConfig)
	})

	describe("createEmbedder", () => {
		it("should create RooEmbedderAdapter with correct dimension from config", () => {
			// Setup mock embedder from code index factory
			const mockCodeIndexEmbedder = { embed: vi.fn() }
			const mockCodeIndexFactory = {
				createEmbedder: vi.fn().mockReturnValue(mockCodeIndexEmbedder),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockCodeIndexFactory as any)
			MockedCacheManager.mockImplementation(() => ({}) as any)

			const embedder = factory.createEmbedder()

			// Verify CodeIndexServiceFactory was created with correct parameters
			expect(MockedCodeIndexServiceFactory).toHaveBeenCalledWith(
				mockCodeIndexConfig,
				testWorkspacePath,
				expect.any(Object), // CacheManager instance
			)

			// Verify RooEmbedderAdapter was created with correct parameters
			expect(MockedRooEmbedderAdapter).toHaveBeenCalledWith(
				mockCodeIndexEmbedder,
				1536, // currentModelDimension
			)

			expect(embedder).toBeDefined()
		})

		it("should use default dimension when config dimension is undefined", () => {
			const mockCodeIndexEmbedder = { embed: vi.fn() }
			const mockCodeIndexFactory = {
				createEmbedder: vi.fn().mockReturnValue(mockCodeIndexEmbedder),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockCodeIndexFactory as any)
			MockedCacheManager.mockImplementation(() => ({}) as any)

			// Set config to return undefined dimension
			mockCodeIndexConfig.currentModelDimension = undefined

			factory.createEmbedder()

			expect(MockedRooEmbedderAdapter).toHaveBeenCalledWith(
				mockCodeIndexEmbedder,
				1536, // default dimension
			)
		})

		it("should create CacheManager with fake VSCode context", () => {
			const mockCodeIndexEmbedder = { embed: vi.fn() }
			const mockCodeIndexFactory = {
				createEmbedder: vi.fn().mockReturnValue(mockCodeIndexEmbedder),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockCodeIndexFactory as any)
			MockedCacheManager.mockImplementation(() => ({}) as any)

			factory.createEmbedder()

			expect(MockedCacheManager).toHaveBeenCalledWith(
				expect.objectContaining({
					globalStorageUri: expect.any(Object), // Any VSCode URI is acceptable
					subscriptions: [],
				}),
				testWorkspacePath,
			)
		})
	})

	describe("createVectorStore", () => {
		it("should create QdrantMemoryStore with configuration from CodeIndex", () => {
			const vectorStore = factory.createVectorStore()

			expect(MockedQdrantMemoryStore).toHaveBeenCalledWith(
				testWorkspacePath,
				"http://localhost:6333", // qdrantConfig.url
				1536, // currentModelDimension
				"test-qdrant-key", // qdrantConfig.apiKey
			)

			expect(vectorStore).toBeDefined()
		})

		it("should use default Qdrant URL when config URL is undefined", () => {
			mockCodeIndexConfig.qdrantConfig = {
				url: undefined,
				apiKey: "test-key",
			}

			factory.createVectorStore()

			expect(MockedQdrantMemoryStore).toHaveBeenCalledWith(
				testWorkspacePath,
				"http://localhost:6333", // default URL
				1536,
				"test-key",
			)
		})

		it("should use default dimension when config dimension is undefined", () => {
			mockCodeIndexConfig.currentModelDimension = undefined

			factory.createVectorStore()

			expect(MockedQdrantMemoryStore).toHaveBeenCalledWith(
				testWorkspacePath,
				"http://localhost:6333",
				1536, // default dimension
				"test-qdrant-key",
			)
		})

		it("should handle missing API key", () => {
			mockCodeIndexConfig.qdrantConfig = {
				url: "http://localhost:6333",
				apiKey: undefined,
			}

			factory.createVectorStore()

			expect(MockedQdrantMemoryStore).toHaveBeenCalledWith(
				testWorkspacePath,
				"http://localhost:6333",
				1536,
				undefined, // missing API key
			)
		})
	})

	describe("createLlmProviderFromEnv", () => {
		const originalEnv = process.env

		beforeEach(() => {
			process.env = { ...originalEnv }
		})

		afterEach(() => {
			process.env = originalEnv
		})

		it("should return undefined when OPENAI_API_KEY is not set", () => {
			delete process.env.OPENAI_API_KEY

			const provider = factory.createLlmProviderFromEnv()

			expect(provider).toBeUndefined()
		})

		it("should create provider when API key is available", () => {
			process.env.OPENAI_API_KEY = "test-openai-key"
			process.env.MEMORY_LLM_MODEL = "gpt-4o-mini"

			const provider = factory.createLlmProviderFromEnv()

			expect(provider).toBeDefined()
			expect(typeof provider?.generateJson).toBe("function")
		})

		it("should handle missing model environment variable", () => {
			process.env.OPENAI_API_KEY = "test-key"
			delete process.env.MEMORY_LLM_MODEL

			const provider = factory.createLlmProviderFromEnv()

			expect(provider).toBeDefined()
			// Default model should be used (gpt-4o-mini)
		})

		it("should handle empty API key", () => {
			process.env.OPENAI_API_KEY = ""

			const provider = factory.createLlmProviderFromEnv()

			expect(provider).toBeUndefined()
		})
	})

	describe("dependency integration", () => {
		it("should initialize with CodeIndexConfigManager", () => {
			expect(factory).toBeDefined()
			// Verify it uses the provided config manager
			expect((factory as any).codeIndexConfig).toBe(mockCodeIndexConfig)
		})

		it("should delegate embedder creation to CodeIndexServiceFactory", () => {
			const mockCodeIndexEmbedder = { embed: vi.fn() }
			const mockCodeIndexFactory = {
				createEmbedder: vi.fn().mockReturnValue(mockCodeIndexEmbedder),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockCodeIndexFactory as any)
			MockedCacheManager.mockImplementation(() => ({}) as any)

			factory.createEmbedder()

			expect(mockCodeIndexFactory.createEmbedder).toHaveBeenCalled()
			expect(MockedRooEmbedderAdapter).toHaveBeenCalledWith(mockCodeIndexEmbedder, expect.any(Number))
		})

		it("should use workspace path consistently across services", () => {
			const mockCodeIndexEmbedder = { embed: vi.fn() }
			const mockCodeIndexFactory = {
				createEmbedder: vi.fn().mockReturnValue(mockCodeIndexEmbedder),
			}
			MockedCodeIndexServiceFactory.mockImplementation(() => mockCodeIndexFactory as any)
			MockedCacheManager.mockImplementation(() => ({}) as any)

			factory.createEmbedder()
			factory.createVectorStore()

			// Verify workspace path is used consistently
			expect(MockedCodeIndexServiceFactory).toHaveBeenCalledWith(
				expect.anything(),
				testWorkspacePath,
				expect.anything(),
			)

			expect(MockedQdrantMemoryStore).toHaveBeenCalledWith(
				testWorkspacePath,
				expect.any(String),
				expect.any(Number),
				expect.anything(),
			)
		})
	})
})
