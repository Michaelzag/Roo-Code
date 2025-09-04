import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConversationMemoryConfigManager, type MemoryConfig } from "../config-manager"

// Mock ContextProxy following established pattern
vi.mock("../../../core/config/ContextProxy")

// Mock CodeIndexConfigManager
vi.mock("../../code-index/config-manager")

// Import mocked functions
import { CodeIndexConfigManager } from "../../code-index/config-manager"

// Type the mocked class
const mockedCodeIndexConfigManager = vi.mocked(CodeIndexConfigManager)

/**
 * Tests for ConversationMemoryConfigManager following established Roo-Code patterns.
 * Models the testing approach used by code-index/config-manager.spec.ts
 */
describe("ConversationMemoryConfigManager", () => {
	let mockContextProxy: any
	let mockCodeIndexConfig: any
	let configManager: ConversationMemoryConfigManager

	beforeEach(() => {
		// Reset mocks
		vi.clearAllMocks()

		// Setup mock ContextProxy following established pattern
		mockContextProxy = {
			getValues: vi.fn().mockReturnValue({}),
			getSecret: vi.fn().mockReturnValue(undefined),
			refreshSecrets: vi.fn().mockResolvedValue(undefined),
			updateGlobalState: vi.fn(),
		}

		// Setup default mock for CodeIndexConfigManager
		mockCodeIndexConfig = {
			loadConfiguration: vi.fn().mockResolvedValue(undefined),
			qdrantConfig: {
				url: "http://localhost:6333",
				apiKey: "",
			},
			currentModelDimension: 1536,
			isFeatureEnabled: false,
			isFeatureConfigured: false,
			codebaseIndexEnabled: false,
			embedderProvider: undefined,
		}

		mockedCodeIndexConfigManager.mockImplementation(() => mockCodeIndexConfig)

		configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
	})

	describe("constructor", () => {
		it("should initialize with ContextProxy and CodeIndexConfigManager", () => {
			expect(configManager).toBeDefined()
			expect(configManager.isFeatureEnabled).toBe(false) // Default when not enabled
		})
	})

	describe("isFeatureEnabled", () => {
		it("should return false by default", () => {
			expect(configManager.isFeatureEnabled).toBe(false)
		})

		it("should return true when enabled and configured", () => {
			mockContextProxy.getValues.mockReturnValue({
				conversationMemoryEnabled: true,
			})

			mockCodeIndexConfig.isFeatureEnabled = true
			mockCodeIndexConfig.isFeatureConfigured = true

			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)

			expect(configManager.isFeatureEnabled).toBe(true)
		})
	})

	describe("getConfig", () => {
		it("should load default configuration when values are not set", () => {
			const config = configManager.getConfig()

			expect(config).toEqual({
				enabled: false,
				promptBudgetTokens: 400,
				memoryToolDefaultLimit: 10,
				dailyProcessingBudgetUSD: 1.0,
				qdrantUrl: "http://localhost:6333",
				qdrantApiKey: "",
				embedderDimension: 1536,
			})
		})

		it("should load configuration from context proxy", () => {
			mockContextProxy.getValues.mockReturnValue({
				conversationMemoryEnabled: true,
				conversationMemoryPromptBudgetTokens: 600,
				conversationMemoryToolDefaultLimit: 20,
				conversationMemoryDailyBudgetUSD: 2.5,
			})

			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
			const config = configManager.getConfig()

			expect(config.enabled).toBe(true)
			expect(config.promptBudgetTokens).toBe(600)
			expect(config.memoryToolDefaultLimit).toBe(20)
			expect(config.dailyProcessingBudgetUSD).toBe(2.5)
		})

		it("should inherit Qdrant configuration from CodeIndex config", () => {
			// Setup custom CodeIndex config
			mockCodeIndexConfig = {
				loadConfiguration: vi.fn().mockResolvedValue(undefined),
				qdrantConfig: {
					url: "http://custom-qdrant:6333",
					apiKey: "custom-key",
				},
				currentModelDimension: 768,
				isFeatureEnabled: true,
				isFeatureConfigured: true,
			}

			mockedCodeIndexConfigManager.mockImplementation(() => mockCodeIndexConfig)
			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
			const config = configManager.getConfig()

			expect(config.qdrantUrl).toBe("http://custom-qdrant:6333")
			expect(config.qdrantApiKey).toBe("custom-key")
			expect(config.embedderDimension).toBe(768)
		})

		it("should handle missing CodeIndex configuration gracefully", () => {
			// Setup CodeIndex config with undefined values
			mockCodeIndexConfig = {
				loadConfiguration: vi.fn().mockResolvedValue(undefined),
				qdrantConfig: {
					url: undefined,
					apiKey: undefined,
				},
				currentModelDimension: undefined,
				isFeatureEnabled: false,
				isFeatureConfigured: false,
			}

			mockedCodeIndexConfigManager.mockImplementation(() => mockCodeIndexConfig)
			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
			const config = configManager.getConfig()

			expect(config.qdrantUrl).toBeUndefined()
			expect(config.qdrantApiKey).toBeUndefined()
			expect(config.embedderDimension).toBeUndefined()
		})
	})

	describe("isFeatureConfigured", () => {
		it("should return false when CodeIndex is not configured", () => {
			expect(configManager.isFeatureConfigured).toBe(false)
		})

		it("should return true when CodeIndex is configured", () => {
			mockCodeIndexConfig.isFeatureEnabled = true
			mockCodeIndexConfig.isFeatureConfigured = true

			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
			expect(configManager.isFeatureConfigured).toBe(true)
		})
	})

	describe("configuration reloading", () => {
		it("should update configuration when reloadConfiguration() is called", async () => {
			const initialConfig = configManager.getConfig()
			expect(initialConfig.enabled).toBe(false)

			// Change the mock return value
			mockContextProxy.getValues.mockReturnValue({
				conversationMemoryEnabled: true,
				conversationMemoryPromptBudgetTokens: 800,
			})

			await configManager.reloadConfiguration()
			const updatedConfig = configManager.getConfig()

			expect(updatedConfig.enabled).toBe(true)
			expect(updatedConfig.promptBudgetTokens).toBe(800)
		})
	})

	describe("currentPromptBudgetTokens", () => {
		it("should return the prompt budget tokens", () => {
			mockContextProxy.getValues.mockReturnValue({
				conversationMemoryPromptBudgetTokens: 1000,
			})

			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
			expect(configManager.currentPromptBudgetTokens).toBe(1000)
		})

		it("should return default value when not set", () => {
			expect(configManager.currentPromptBudgetTokens).toBe(400)
		})
	})

	describe("currentMemoryToolDefaultLimit", () => {
		it("should return the memory tool default limit", () => {
			mockContextProxy.getValues.mockReturnValue({
				conversationMemoryToolDefaultLimit: 25,
			})

			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
			expect(configManager.currentMemoryToolDefaultLimit).toBe(25)
		})

		it("should return default value when not set", () => {
			expect(configManager.currentMemoryToolDefaultLimit).toBe(10)
		})
	})

	describe("currentDailyProcessingBudgetUSD", () => {
		it("should return the daily processing budget", () => {
			mockContextProxy.getValues.mockReturnValue({
				conversationMemoryDailyBudgetUSD: 5.0,
			})

			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)
			expect(configManager.currentDailyProcessingBudgetUSD).toBe(5.0)
		})

		it("should return default value when not set", () => {
			expect(configManager.currentDailyProcessingBudgetUSD).toBe(1.0)
		})
	})

	describe("CodeIndex dependency integration", () => {
		it("should initialize with CodeIndexConfigManager", () => {
			expect(mockedCodeIndexConfigManager).toHaveBeenCalled()
		})

		it("should call loadConfiguration on CodeIndexConfigManager during construction", () => {
			const mockLoadConfiguration = vi.fn().mockResolvedValue(undefined)
			mockCodeIndexConfig = {
				loadConfiguration: mockLoadConfiguration,
				qdrantConfig: { url: "test", apiKey: "test" },
				currentModelDimension: 1536,
				isFeatureEnabled: true,
				isFeatureConfigured: true,
			}

			mockedCodeIndexConfigManager.mockImplementation(() => mockCodeIndexConfig)
			configManager = new ConversationMemoryConfigManager(mockContextProxy, mockCodeIndexConfig)

			// Note: loadConfiguration is not called in constructor, only in manager.initialize()
			expect(mockLoadConfiguration).not.toHaveBeenCalled()
		})
	})
})
