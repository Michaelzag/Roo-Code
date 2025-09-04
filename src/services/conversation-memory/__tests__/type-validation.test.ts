/**
 * Type System Validation Tests for Conversation Memory
 *
 * This test suite validates the conversation-memory type system including:
 * - Core type definitions and interfaces
 * - Interface contract compliance
 * - Enum and constant validation
 * - Complex type compositions and constraints
 * - TypeScript compilation and type safety
 */

import { describe, it, expect, vi } from "vitest"
import type {
	FactCategory,
	Message,
	ConversationEpisode,
	ProjectContext,
	ConversationFact,
	CategorizedFactInput,
	MemoryActionType,
	MemoryAction,
	SearchOptions,
	SegmentationMode,
	EpisodeConfig,
	EpisodeSearchResult,
} from "../types"
import type { IEmbedder, ILlmProvider, IVectorStore, VectorRecord } from "../interfaces"
import type { IEpisodeDetector, IEpisodeContextGenerator, HintsProvider } from "../interfaces/episode"

describe("Conversation Memory Type System Validation", () => {
	describe("Core Type Validation", () => {
		/**
		 * Test Message interface structure validation
		 */
		it("should validate Message interface structure", () => {
			const validMessage: Message = {
				role: "user",
				content: "Test message",
				timestamp: "2023-01-01T00:00:00.000Z",
			}

			expect(validMessage.role).toBe("user")
			expect(validMessage.content).toBe("Test message")
			expect(validMessage.timestamp).toBe("2023-01-01T00:00:00.000Z")

			// Test required fields
			const minimalMessage: Message = {
				role: "assistant",
				content: "Response",
			}
			expect(minimalMessage.role).toBe("assistant")
			expect(minimalMessage.content).toBe("Response")
			expect(minimalMessage.timestamp).toBeUndefined()
		})

		/**
		 * Test ConversationEpisode interface validation with all required fields
		 */
		it("should validate ConversationEpisode interface structure", () => {
			const episode: ConversationEpisode = {
				episode_id: "ep-123",
				messages: [
					{ role: "user", content: "Hello" },
					{ role: "assistant", content: "Hi there" },
				],
				reference_time: new Date("2023-01-01"),
				workspace_id: "ws-456",
				workspace_path: "/test/workspace",
				context_description: "Testing conversation",
				start_time: new Date("2023-01-01T10:00:00"),
				end_time: new Date("2023-01-01T10:05:00"),
				message_count: 2,
			}

			expect(episode.episode_id).toBe("ep-123")
			expect(episode.messages).toHaveLength(2)
			expect(episode.reference_time).toBeInstanceOf(Date)
			expect(episode.workspace_id).toBe("ws-456")
			expect(episode.workspace_path).toBe("/test/workspace")
			expect(episode.context_description).toBe("Testing conversation")
			expect(episode.start_time).toBeInstanceOf(Date)
			expect(episode.end_time).toBeInstanceOf(Date)
			expect(episode.message_count).toBe(2)
		})

		/**
		 * Test ProjectContext interface with optional fields
		 */
		it("should validate ProjectContext interface with optional fields", () => {
			const minimalContext: ProjectContext = {
				workspaceName: "test-project",
				language: "typescript",
			}

			const fullContext: ProjectContext = {
				workspaceName: "full-project",
				language: "javascript",
				framework: "react",
				packageManager: "npm",
			}

			expect(minimalContext.workspaceName).toBe("test-project")
			expect(minimalContext.language).toBe("typescript")
			expect(minimalContext.framework).toBeUndefined()
			expect(minimalContext.packageManager).toBeUndefined()

			expect(fullContext.framework).toBe("react")
			expect(fullContext.packageManager).toBe("npm")
		})

		/**
		 * Test ConversationFact interface with all properties including optional ones
		 */
		it("should validate ConversationFact interface structure", () => {
			const fact: ConversationFact = {
				id: "fact-789",
				content: "This is a test fact",
				category: "infrastructure",
				confidence: 0.95,
				reference_time: new Date("2023-01-01"),
				ingestion_time: new Date("2023-01-01T12:00:00"),
				workspace_id: "ws-456",
				workspace_path: "/test/workspace",
				project_context: {
					workspaceName: "test-project",
					language: "typescript",
				},
				conversation_context: "Testing context",
				episode_id: "ep-123",
				episode_context: "Episode testing",
				embedding: [0.1, 0.2, 0.3],
				metadata: { source: "test" },
				superseded_by: "fact-890",
				superseded_at: new Date("2023-01-02"),
				resolved: true,
				resolved_at: new Date("2023-01-03"),
				derived_from: "fact-678",
				derived_pattern_created: false,
				last_confirmed: new Date("2023-01-04"),
				source_model: "gpt-4",
			}

			expect(fact.id).toBe("fact-789")
			expect(fact.category).toBe("infrastructure")
			expect(fact.confidence).toBe(0.95)
			expect(fact.embedding).toEqual([0.1, 0.2, 0.3])
			expect(fact.metadata).toEqual({ source: "test" })
			expect(fact.resolved).toBe(true)
		})

		/**
		 * Test CategorizedFactInput interface with optional fields
		 */
		it("should validate CategorizedFactInput interface structure", () => {
			const minimalInput: CategorizedFactInput = {
				content: "Test input",
				category: "pattern",
				confidence: 0.8,
			}

			const fullInput: CategorizedFactInput = {
				content: "Full test input",
				category: "debugging",
				confidence: 0.9,
				embedding: [0.4, 0.5, 0.6],
				reference_time: new Date("2023-01-01"),
				context_description: "Full context",
				episode_id: "ep-456",
				episode_context: "Full episode context",
				source_model: "claude-3",
				metadata: { type: "test" },
			}

			expect(minimalInput.content).toBe("Test input")
			expect(minimalInput.category).toBe("pattern")
			expect(minimalInput.embedding).toBeUndefined()

			expect(fullInput.embedding).toEqual([0.4, 0.5, 0.6])
			expect(fullInput.source_model).toBe("claude-3")
		})

		/**
		 * Test EpisodeConfig interface with nested configuration options
		 */
		it("should validate EpisodeConfig interface with nested options", () => {
			const minimalConfig: EpisodeConfig = {}

			const fullConfig: EpisodeConfig = {
				timeGapMin: 45,
				maxMessages: 30,
				topicPatterns: ["react", "typescript"],
				segmentation: {
					mode: "semantic",
					semantic: {
						driftK: 2.0,
						minWindow: 7,
						distance: "cosine",
					},
					boundaryRefiner: true,
				},
				context: {
					preferLLM: true,
					hints: {
						source: "auto",
						extra: ["testing", "vitest"],
					},
				},
			}

			expect(minimalConfig.timeGapMin).toBeUndefined()
			expect(fullConfig.timeGapMin).toBe(45)
			expect(fullConfig.segmentation?.semantic?.driftK).toBe(2.0)
			expect(fullConfig.context?.hints?.extra).toEqual(["testing", "vitest"])
		})

		/**
		 * Test SearchOptions interface with filtering capabilities
		 */
		it("should validate SearchOptions interface structure", () => {
			const basicOptions: SearchOptions = {
				limit: 10,
			}

			const complexOptions: SearchOptions = {
				limit: 50,
				filters: {
					category: "architecture",
					resolved: false,
					after: new Date("2023-01-01"),
					before: new Date("2023-12-31"),
					episode_id: "ep-789",
				},
			}

			expect(basicOptions.limit).toBe(10)
			expect(basicOptions.filters).toBeUndefined()

			expect(complexOptions.filters?.category).toBe("architecture")
			expect(complexOptions.filters?.resolved).toBe(false)
			expect(complexOptions.filters?.after).toBeInstanceOf(Date)
		})

		/**
		 * Test EpisodeSearchResult interface structure
		 */
		it("should validate EpisodeSearchResult interface structure", () => {
			const searchResult: EpisodeSearchResult = {
				episode_id: "ep-search-123",
				episode_context: "Search result context",
				relevance_score: 0.87,
				fact_count: 5,
				facts: [
					{
						id: "fact-1",
						content: "Test fact",
						category: "infrastructure",
						confidence: 0.9,
						reference_time: new Date(),
						ingestion_time: new Date(),
						workspace_id: "ws-1",
						project_context: { workspaceName: "test", language: "js" },
						conversation_context: "test",
						embedding: [0.1],
						metadata: {},
					},
				],
				timeframe: "2023-01-01 to 2023-01-02",
			}

			expect(searchResult.episode_id).toBe("ep-search-123")
			expect(searchResult.relevance_score).toBe(0.87)
			expect(searchResult.fact_count).toBe(5)
			expect(searchResult.facts).toHaveLength(1)
		})
	})

	describe("Interface Contract Testing", () => {
		/**
		 * Test IEmbedder interface contract compliance
		 */
		it("should validate IEmbedder interface contract", () => {
			const mockEmbedder: IEmbedder = {
				dimension: 768,
				embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
				embedBatch: vi.fn().mockResolvedValue([
					[0.1, 0.2],
					[0.3, 0.4],
				]),
			}

			expect(mockEmbedder.dimension).toBe(768)
			expect(typeof mockEmbedder.embed).toBe("function")
			expect(typeof mockEmbedder.embedBatch).toBe("function")
		})

		/**
		 * Test ILlmProvider interface contract compliance
		 */
		it("should validate ILlmProvider interface contract", () => {
			const mockLlmProvider: ILlmProvider = {
				generateJson: vi.fn().mockResolvedValue({ result: "test" }),
				generateText: vi.fn().mockResolvedValue("Generated text"),
			}

			expect(typeof mockLlmProvider.generateJson).toBe("function")
			expect(typeof mockLlmProvider.generateText).toBe("function")
		})

		/**
		 * Test IVectorStore interface contract with all required methods
		 */
		it("should validate IVectorStore interface contract", () => {
			const mockVectorStore: IVectorStore = {
				ensureCollection: vi.fn().mockResolvedValue(undefined),
				collectionName: vi.fn().mockReturnValue("test-collection"),
				upsert: vi.fn().mockResolvedValue(undefined),
				insert: vi.fn().mockResolvedValue(undefined),
				update: vi.fn().mockResolvedValue(undefined),
				delete: vi.fn().mockResolvedValue(undefined),
				get: vi.fn().mockResolvedValue(undefined),
				search: vi.fn().mockResolvedValue([]),
				filter: vi.fn().mockResolvedValue([]),
				clearCollection: vi.fn().mockResolvedValue(undefined),
				deleteCollection: vi.fn().mockResolvedValue(undefined),
			}

			expect(typeof mockVectorStore.ensureCollection).toBe("function")
			expect(typeof mockVectorStore.collectionName).toBe("function")
			expect(typeof mockVectorStore.search).toBe("function")
			expect(typeof mockVectorStore.filter).toBe("function")
		})

		/**
		 * Test VectorRecord generic type parameter handling
		 */
		it("should validate VectorRecord generic type support", () => {
			interface CustomPayload {
				category: string
				timestamp: Date
			}

			const record: VectorRecord<CustomPayload> = {
				id: "vec-123",
				vector: [0.1, 0.2, 0.3],
				payload: {
					category: "test",
					timestamp: new Date(),
				},
				score: 0.95,
			}

			expect(record.id).toBe("vec-123")
			expect(record.payload.category).toBe("test")
			expect(record.payload.timestamp).toBeInstanceOf(Date)
			expect(record.score).toBe(0.95)
		})

		/**
		 * Test IEpisodeDetector interface contract
		 */
		it("should validate IEpisodeDetector interface contract", () => {
			const mockDetector: IEpisodeDetector = {
				detect: vi.fn().mockResolvedValue([]),
			}

			expect(typeof mockDetector.detect).toBe("function")
		})

		/**
		 * Test IEpisodeContextGenerator interface contract
		 */
		it("should validate IEpisodeContextGenerator interface contract", () => {
			const mockGenerator: IEpisodeContextGenerator = {
				describe: vi.fn().mockResolvedValue("Generated description"),
			}

			expect(typeof mockGenerator.describe).toBe("function")
		})

		/**
		 * Test HintsProvider interface contract
		 */
		it("should validate HintsProvider interface contract", () => {
			const mockHintsProvider: HintsProvider = {
				getHints: vi.fn().mockResolvedValue({
					deps: ["react", "typescript"],
					tags: ["component", "hook"],
					dirs: ["src", "components"],
					extra: ["testing"],
				}),
			}

			expect(typeof mockHintsProvider.getHints).toBe("function")
		})

		/**
		 * Test method signature validation for async operations
		 */
		it("should validate async method signatures return Promises", async () => {
			const mockEmbedder: IEmbedder = {
				dimension: 512,
				embed: vi.fn().mockResolvedValue([0.1, 0.2]),
				embedBatch: vi.fn().mockResolvedValue([[0.1], [0.2]]),
			}

			const embedResult = mockEmbedder.embed("test")
			const batchResult = mockEmbedder.embedBatch(["test1", "test2"])

			expect(embedResult).toBeInstanceOf(Promise)
			expect(batchResult).toBeInstanceOf(Promise)

			await expect(embedResult).resolves.toEqual([0.1, 0.2])
			await expect(batchResult).resolves.toEqual([[0.1], [0.2]])
		})
	})

	describe("Enum and Constant Validation", () => {
		/**
		 * Test FactCategory enum values
		 */
		it("should validate FactCategory enum values", () => {
			const validCategories: FactCategory[] = ["infrastructure", "architecture", "debugging", "pattern"]

			validCategories.forEach((category) => {
				const fact: Partial<ConversationFact> = {
					category,
				}
				expect(fact.category).toBe(category)
			})

			// Test that these are the only valid values
			expect(validCategories).toHaveLength(4)
		})

		/**
		 * Test MemoryActionType enum values
		 */
		it("should validate MemoryActionType enum values", () => {
			const validActionTypes: MemoryActionType[] = ["ADD", "UPDATE", "SUPERSEDE", "DELETE_EXISTING", "IGNORE"]

			validActionTypes.forEach((actionType) => {
				const action: Partial<MemoryAction> = {
					type: actionType,
				}
				expect(action.type).toBe(actionType)
			})

			expect(validActionTypes).toHaveLength(5)
		})

		/**
		 * Test SegmentationMode enum values
		 */
		it("should validate SegmentationMode enum values", () => {
			const validModes: SegmentationMode[] = ["heuristic", "semantic", "llm_verified"]

			validModes.forEach((mode) => {
				const config: Partial<EpisodeConfig> = {
					segmentation: {
						mode,
					},
				}
				expect(config.segmentation?.mode).toBe(mode)
			})

			expect(validModes).toHaveLength(3)
		})

		/**
		 * Test Message role enum values
		 */
		it("should validate Message role enum values", () => {
			const validRoles = ["user", "assistant", "system"] as const

			validRoles.forEach((role) => {
				const message: Message = {
					role,
					content: "test content",
				}
				expect(message.role).toBe(role)
			})

			expect(validRoles).toHaveLength(3)
		})

		/**
		 * Test EpisodeConfig default value behaviors
		 */
		it("should validate EpisodeConfig default value expectations", () => {
			const config: EpisodeConfig = {
				timeGapMin: 30, // default expectation
				maxMessages: 25, // default expectation
				segmentation: {
					mode: "semantic", // default expectation
					semantic: {
						driftK: 2.5, // default expectation
						minWindow: 5, // default expectation
						distance: "cosine", // default expectation
					},
					boundaryRefiner: true, // default when mode === 'llm_verified'
				},
				context: {
					preferLLM: true, // default expectation
					hints: {
						source: "auto", // default expectation
					},
				},
			}

			expect(config.timeGapMin).toBe(30)
			expect(config.maxMessages).toBe(25)
			expect(config.segmentation?.mode).toBe("semantic")
			expect(config.segmentation?.semantic?.driftK).toBe(2.5)
			expect(config.context?.preferLLM).toBe(true)
		})

		/**
		 * Test hints source enum values
		 */
		it("should validate hints source enum values", () => {
			const validSources = ["none", "workspace", "memory", "auto"] as const

			validSources.forEach((source) => {
				const config: EpisodeConfig = {
					context: {
						hints: {
							source,
						},
					},
				}
				expect(config.context?.hints?.source).toBe(source)
			})

			expect(validSources).toHaveLength(4)
		})

		/**
		 * Test distance metric enum values
		 */
		it("should validate distance metric enum values", () => {
			const validDistances = ["cosine", "dot"] as const

			validDistances.forEach((distance) => {
				const config: EpisodeConfig = {
					segmentation: {
						semantic: {
							distance,
						},
					},
				}
				expect(config.segmentation?.semantic?.distance).toBe(distance)
			})

			expect(validDistances).toHaveLength(2)
		})
	})

	describe("Complex Type Composition", () => {
		/**
		 * Test nested object type validation in EpisodeConfig
		 */
		it("should validate complex nested object types", () => {
			const complexConfig: EpisodeConfig = {
				segmentation: {
					mode: "llm_verified",
					semantic: {
						driftK: 3.0,
						minWindow: 8,
						distance: "dot",
					},
					boundaryRefiner: false,
				},
				context: {
					preferLLM: false,
					hints: {
						source: "workspace",
						extra: ["custom", "keywords"],
					},
				},
			}

			// Test deep nesting access
			expect(complexConfig.segmentation?.semantic?.driftK).toBe(3.0)
			expect(complexConfig.context?.hints?.extra).toEqual(["custom", "keywords"])

			// Test optional chaining behavior
			expect(complexConfig.segmentation?.semantic?.distance).toBe("dot")
			expect(complexConfig.context?.preferLLM).toBe(false)
		})

		/**
		 * Test array type constraints in various interfaces
		 */
		it("should validate array type constraints", () => {
			const episode: ConversationEpisode = {
				episode_id: "ep-array-test",
				messages: [
					{ role: "user", content: "First message" },
					{ role: "assistant", content: "Second message" },
					{ role: "system", content: "System message" },
				],
				reference_time: new Date(),
				workspace_id: "ws-test",
				context_description: "Array testing",
				start_time: new Date(),
				end_time: new Date(),
				message_count: 3,
			}

			expect(Array.isArray(episode.messages)).toBe(true)
			expect(episode.messages).toHaveLength(3)
			expect(episode.messages[0].role).toBe("user")

			// Test embedding array
			const fact: Partial<ConversationFact> = {
				embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
			}
			expect(Array.isArray(fact.embedding)).toBe(true)
			expect(fact.embedding).toHaveLength(5)
		})

		/**
		 * Test union type behavior with FactCategory
		 */
		it("should validate union type behavior", () => {
			const categories: FactCategory[] = ["infrastructure", "pattern"]

			categories.forEach((category) => {
				const factInput: CategorizedFactInput = {
					content: `Test for ${category}`,
					category,
					confidence: 0.8,
				}

				expect(factInput.category).toBe(category)
				expect(["infrastructure", "architecture", "debugging", "pattern"]).toContain(category)
			})
		})

		/**
		 * Test generic type parameter behavior with VectorRecord
		 */
		it("should validate generic type parameter constraints", () => {
			interface FactPayload {
				factId: string
				category: FactCategory
				metadata: Record<string, unknown>
			}

			const vectorRecord: VectorRecord<FactPayload> = {
				id: "vec-generic-test",
				vector: [0.1, 0.2, 0.3],
				payload: {
					factId: "fact-456",
					category: "debugging",
					metadata: {
						source: "unit-test",
						confidence: 0.95,
					},
				},
			}

			expect(vectorRecord.payload.factId).toBe("fact-456")
			expect(vectorRecord.payload.category).toBe("debugging")
			expect(vectorRecord.payload.metadata.source).toBe("unit-test")
		})

		/**
		 * Test type intersection and composition with Record types
		 */
		it("should validate Record type compositions", () => {
			const searchOptions: SearchOptions = {
				limit: 25,
				filters: {
					category: "architecture",
					resolved: true,
					after: new Date("2023-01-01"),
				},
			}

			// Test Partial<> behavior in filters
			expect(searchOptions.filters?.category).toBe("architecture")
			expect(searchOptions.filters?.resolved).toBe(true)
			expect(searchOptions.filters?.before).toBeUndefined()
			expect(searchOptions.filters?.episode_id).toBeUndefined()

			// Test Record<string, any> in metadata
			const fact: Partial<ConversationFact> = {
				metadata: {
					stringProp: "test",
					numberProp: 42,
					booleanProp: true,
					objectProp: { nested: "value" },
					arrayProp: [1, 2, 3],
				},
			}

			expect(fact.metadata?.stringProp).toBe("test")
			expect(fact.metadata?.numberProp).toBe(42)
			expect(fact.metadata?.objectProp.nested).toBe("value")
		})

		/**
		 * Test optional vs required field compositions
		 */
		it("should validate optional vs required field constraints", () => {
			// Test minimal required fields
			const minimalMessage: Message = {
				role: "user",
				content: "Required only",
			}
			expect(minimalMessage.timestamp).toBeUndefined()

			// Test that workspace_path is optional but workspace_id is required
			const episode: ConversationEpisode = {
				episode_id: "ep-optional-test",
				messages: [minimalMessage],
				reference_time: new Date(),
				workspace_id: "required-ws-id", // required
				// workspace_path omitted (optional)
				context_description: "Optional field testing",
				start_time: new Date(),
				end_time: new Date(),
				message_count: 1,
			}

			expect(episode.workspace_id).toBe("required-ws-id")
			expect(episode.workspace_path).toBeUndefined()

			// Test CategorizedFactInput required vs optional
			const minimalFactInput: CategorizedFactInput = {
				content: "Required content",
				category: "infrastructure", // required
				confidence: 0.8, // required
				// All other fields optional
			}

			expect(minimalFactInput.embedding).toBeUndefined()
			expect(minimalFactInput.episode_id).toBeUndefined()
			expect(minimalFactInput.metadata).toBeUndefined()
		})
	})
})
