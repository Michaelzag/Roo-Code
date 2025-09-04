import * as vscode from "vscode"
import { ContextProxy } from "../../core/config/ContextProxy"
import { CodeIndexConfigManager } from "../code-index/config-manager"
import type { EpisodeConfig } from "./types"

export interface MemoryConfig {
	enabled: boolean
	promptBudgetTokens: number
	memoryToolDefaultLimit?: number
	dailyProcessingBudgetUSD?: number
	// Episode configuration
	episodes?: EpisodeConfig
	// Derived from Code Index by default
	qdrantUrl?: string
	qdrantApiKey?: string
	embedderDimension?: number
}

/**
 * Manages configuration for conversation memory feature.
 * Follows the same pattern as CodeIndexConfigManager.
 */
export class ConversationMemoryConfigManager {
	private conversationMemoryEnabled: boolean = false
	private promptBudgetTokens: number = 400
	private memoryToolDefaultLimit: number = 10
	private dailyProcessingBudgetUSD: number = 1.0
	private episodeConfig: EpisodeConfig = {}
	private codeIndexConfig: CodeIndexConfigManager

	constructor(
		private readonly contextProxy: ContextProxy,
		codeIndexConfig: CodeIndexConfigManager,
	) {
		this.codeIndexConfig = codeIndexConfig
		this._loadAndSetConfiguration()
	}

	/**
	 * Private method that handles loading configuration from storage.
	 * Follows the same pattern as CodeIndexConfigManager.
	 */
	private _loadAndSetConfiguration(): void {
		// Load configuration from storage (flat structure like other settings)
		const values = this.contextProxy?.getValues?.() ?? {}

		// Also check VS Code workspace configuration as fallback
		const vscodeConfig = vscode.workspace.getConfiguration("roo.conversationMemory")

		// Update instance variables with configuration
		// Priority: contextProxy values > VS Code config > defaults
		this.conversationMemoryEnabled =
			values.conversationMemoryEnabled ?? vscodeConfig.get<boolean>("enabled") ?? false

		this.promptBudgetTokens =
			values.conversationMemoryPromptBudgetTokens ?? vscodeConfig.get<number>("promptBudgetTokens") ?? 400

		this.memoryToolDefaultLimit =
			values.conversationMemoryToolDefaultLimit ?? vscodeConfig.get<number>("memoryToolDefaultLimit") ?? 10

		this.dailyProcessingBudgetUSD =
			values.conversationMemoryDailyBudgetUSD ?? vscodeConfig.get<number>("dailyProcessingBudgetUSD") ?? 1.0

		// Load episode configuration with defaults from doc 15
		// For now, use defaults since episode settings aren't in the UI yet
		this.episodeConfig = {
			timeGapMin: 30,
			maxMessages: 25,
			segmentation: {
				mode: "semantic",
				semantic: {
					driftK: 2.5,
					minWindow: 5,
					distance: "cosine",
				},
				boundaryRefiner: true,
			},
			context: {
				preferLLM: true, // Always true since LLM is required
				hints: {
					source: "auto",
					extra: [],
				},
			},
		}

		console.log("[ConversationMemoryConfigManager] Configuration loaded:", {
			enabled: this.conversationMemoryEnabled,
			promptBudgetTokens: this.promptBudgetTokens,
			memoryToolDefaultLimit: this.memoryToolDefaultLimit,
			dailyProcessingBudgetUSD: this.dailyProcessingBudgetUSD,
			episodeMode: this.episodeConfig.segmentation?.mode,
			codeIndexConfigured: this.codeIndexConfig.isFeatureConfigured,
			codeIndexEnabled: this.codeIndexConfig.isFeatureEnabled,
		})
	}

	/**
	 * Reloads configuration from storage.
	 */
	public async reloadConfiguration(): Promise<void> {
		this._loadAndSetConfiguration()
	}

	/**
	 * Gets the current configuration state.
	 */
	public getConfig(): MemoryConfig {
		const qdrant = this.codeIndexConfig.qdrantConfig
		const dim = this.codeIndexConfig.currentModelDimension

		return {
			enabled: this.conversationMemoryEnabled,
			promptBudgetTokens: this.promptBudgetTokens,
			memoryToolDefaultLimit: this.memoryToolDefaultLimit,
			dailyProcessingBudgetUSD: this.dailyProcessingBudgetUSD,
			episodes: this.episodeConfig,
			qdrantUrl: qdrant.url,
			qdrantApiKey: qdrant.apiKey,
			embedderDimension: dim,
		}
	}

	/**
	 * Checks if the feature is enabled.
	 * Follows the same pattern as CodeIndexConfigManager.
	 */
	public get isFeatureEnabled(): boolean {
		return this.conversationMemoryEnabled && this.isFeatureConfigured
	}

	/**
	 * Checks if the feature is properly configured.
	 * Memory requires Code Index to be configured.
	 */
	public get isFeatureConfigured(): boolean {
		// Check if Code Index is enabled and properly configured
		return this.codeIndexConfig.isFeatureEnabled && this.codeIndexConfig.isFeatureConfigured
	}

	/**
	 * Gets the prompt budget in tokens.
	 */
	public get currentPromptBudgetTokens(): number {
		return this.promptBudgetTokens
	}

	/**
	 * Gets the memory tool default limit.
	 */
	public get currentMemoryToolDefaultLimit(): number {
		return this.memoryToolDefaultLimit
	}

	/**
	 * Gets the daily processing budget in USD.
	 */
	public get currentDailyProcessingBudgetUSD(): number {
		return this.dailyProcessingBudgetUSD
	}
}
