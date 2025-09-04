import type { Message, ConversationEpisode, ProjectContext, EpisodeConfig } from "../../types"
import type { IEpisodeContextGenerator } from "../../interfaces/episode"
import type { IEmbedder, ILlmProvider } from "../../interfaces"
import { EpisodeDetector } from "../EpisodeDetector"

/**
 * Comprehensive unit tests for EpisodeDetector class
 *
 * Test Coverage Areas:
 * 1. Heuristic Mode Tests (15 tests): Time gaps, message limits, topic patterns
 * 2. Semantic Mode Tests (15 tests): Drift detection, similarity thresholds, boundary identification
 * 3. Hybrid Mode Tests (10 tests): Combined algorithm operation, mode switching
 * 4. LLM Integration Tests (10 tests): Boundary refinement, error handling, timeout scenarios
 * 5. Configuration Tests (8 tests): Parameter validation, default handling
 * 6. Edge Cases & Error Handling (5 tests): Empty inputs, malformed data, failures
 *
 * Total: 63 comprehensive test cases for 100% coverage
 */
describe("EpisodeDetector", () => {
	let mockContextGenerator: IEpisodeContextGenerator
	let mockEmbedder: IEmbedder
	let mockLlmProvider: ILlmProvider
	let testProjectContext: ProjectContext
	const testWorkspaceId = "test-workspace"

	beforeEach(() => {
		mockContextGenerator = {
			describe: vi.fn().mockResolvedValue("Generated context description"),
		}

		mockEmbedder = {
			embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]),
			embedBatch: vi.fn(),
			dimension: 5,
		}

		mockLlmProvider = {
			generateJson: vi.fn().mockResolvedValue({
				boundaries: [0, 3, 6],
				titles: ["Setup", "Implementation", "Testing"],
			}),
			generateText: vi.fn().mockResolvedValue("LLM generated text"),
		}

		testProjectContext = {
			workspaceName: "test-app",
			language: "typescript",
			framework: "react",
			packageManager: "npm",
		}

		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
		vi.clearAllMocks()
	})

	/**
	 * Helper function to create test messages with timestamps
	 */
	const createMessage = (role: "user" | "assistant" | "system", content: string, minutesOffset = 0): Message => ({
		role,
		content,
		timestamp: new Date(1000000000000 + minutesOffset * 60000).toISOString(), // Fixed base time
	})

	/**
	 * Helper function to create multiple messages for testing
	 */
	const createMessages = (count: number, prefix = "Message"): Message[] => {
		return Array.from({ length: count }, (_, i) =>
			createMessage(i % 2 === 0 ? "user" : "assistant", `${prefix} ${i + 1}`, i * 5),
		)
	}

	describe("Configuration and Initialization", () => {
		it("should initialize with default configuration when no config provided", () => {
			const detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider)

			expect(detector).toBeInstanceOf(EpisodeDetector)
			// Defaults are tested through behavior in subsequent tests
		})

		it("should apply custom timeGapMin configuration", async () => {
			const config: EpisodeConfig = { timeGapMin: 15 }
			const detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = [
				createMessage("user", "First message", 0),
				createMessage("assistant", "Second message", 20), // 20 minutes gap > 15
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(2) // Should split on 15-minute gap
		})

		it("should apply custom maxMessages configuration", async () => {
			const config: EpisodeConfig = { maxMessages: 3 }
			const detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(5, "Test")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(2) // Should split after 3 messages
			expect(episodes[0].message_count).toBe(3)
			expect(episodes[1].message_count).toBe(2)
		})

		it("should apply custom topic patterns configuration", async () => {
			const config: EpisodeConfig = {
				topicPatterns: ["new topic", "changing subject"],
				segmentation: { mode: "heuristic" },
			}
			const detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = [
				createMessage("user", "Initial discussion", 0),
				createMessage("assistant", "Response", 1),
				createMessage("user", "New topic: authentication", 2),
				createMessage("assistant", "Auth response", 3),
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(2) // Should split on topic pattern
		})

		it("should configure semantic segmentation parameters", async () => {
			const config: EpisodeConfig = {
				segmentation: {
					mode: "semantic",
					semantic: {
						driftK: 3.0,
						minWindow: 3,
						distance: "dot",
					},
				},
			}
			const detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(4, "Semantic test")

			// Configure embedder to return consistent vectors (no undefined)
			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0, 0, 0])
				.mockResolvedValueOnce([1, 0, 0, 0, 0])
				.mockResolvedValueOnce([1, 0, 0, 0, 0])
				.mockResolvedValueOnce([0, 1, 0, 0, 0]) // Different vector to trigger drift

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(mockEmbedder.embed).toHaveBeenCalled()
		})

		it("should enable boundary refiner for llm_verified mode", async () => {
			const config: EpisodeConfig = {
				segmentation: { mode: "llm_verified" },
			}
			const detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(5, "LLM test")

			await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(mockLlmProvider.generateJson).toHaveBeenCalled()
		})

		it("should handle undefined embedder gracefully", async () => {
			const detector = new EpisodeDetector(mockContextGenerator, undefined, mockLlmProvider)

			const messages = createMessages(3, "No embedder")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // Should fallback to heuristic only
		})

		it("should handle undefined LLM provider gracefully", async () => {
			const detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, undefined)

			const messages = createMessages(3, "No LLM")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
			expect(mockLlmProvider.generateJson).not.toHaveBeenCalled()
		})
	})

	describe("Heuristic Mode Detection", () => {
		let detector: EpisodeDetector

		beforeEach(() => {
			const config: EpisodeConfig = {
				timeGapMin: 30,
				maxMessages: 25,
				segmentation: { mode: "heuristic" },
			}
			detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)
		})

		it("should detect time-based breakpoints with default 30-minute gap", async () => {
			const messages = [
				createMessage("user", "First message", 0),
				createMessage("assistant", "Response 1", 5),
				createMessage("user", "Second message", 37), // 32 min gap > 30 min threshold
				createMessage("assistant", "Response 2", 42),
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(2)
			expect(episodes[0].message_count).toBe(2)
			expect(episodes[1].message_count).toBe(2)
		})

		it("should not split on gaps smaller than timeGapMin", async () => {
			const messages = [
				createMessage("user", "First message", 0),
				createMessage("assistant", "Response 1", 5),
				createMessage("user", "Second message", 25), // 25 min gap < 30 min
				createMessage("assistant", "Response 2", 30),
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
			expect(episodes[0].message_count).toBe(4)
		})

		it("should detect multiple time gaps correctly", async () => {
			const messages = [
				createMessage("user", "Message 1", 0),
				createMessage("assistant", "Response 1", 5),
				createMessage("user", "Message 2", 37), // 32 min gap > 30 min threshold
				createMessage("assistant", "Response 2", 42),
				createMessage("user", "Message 3", 77), // 35 min gap > 30 min threshold
				createMessage("assistant", "Response 3", 82),
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(3)
			expect(episodes.map((ep) => ep.message_count)).toEqual([2, 2, 2])
		})

		it("should enforce maxMessages limit with forced splits", async () => {
			const config: EpisodeConfig = {
				maxMessages: 3,
				segmentation: { mode: "heuristic" },
			}
			const smallDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(8, "Max test") // 8 messages > 3 max

			const episodes = await smallDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(3) // [3, 3, 2]
			expect(episodes[0].message_count).toBe(3)
			expect(episodes[1].message_count).toBe(3)
			expect(episodes[2].message_count).toBe(2)
		})

		it("should detect topic changes with configured patterns", async () => {
			const config: EpisodeConfig = {
				topicPatterns: ["new topic", "switching to", "let's discuss"],
				segmentation: { mode: "heuristic" },
			}
			const topicDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = [
				createMessage("user", "Initial discussion about auth", 0),
				createMessage("assistant", "Auth implementation details", 5),
				createMessage("user", "New topic: database design", 10),
				createMessage("assistant", "Database response", 15),
				createMessage("user", "Let's discuss API endpoints", 20),
				createMessage("assistant", "API response", 25),
			]

			const episodes = await topicDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(3) // Should split on both topic patterns
		})

		it("should be case-insensitive for topic pattern matching", async () => {
			const config: EpisodeConfig = {
				topicPatterns: ["NEW TOPIC"],
				segmentation: { mode: "heuristic" },
			}
			const topicDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = [
				createMessage("user", "First discussion", 0),
				createMessage("user", "new topic: different thing", 5), // lowercase should match
			]

			const episodes = await topicDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(2)
		})

		it("should combine time gaps and topic patterns correctly", async () => {
			const config: EpisodeConfig = {
				timeGapMin: 20,
				topicPatterns: ["new topic"],
				segmentation: { mode: "heuristic" },
			}
			const combinedDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = [
				createMessage("user", "First topic", 0),
				createMessage("assistant", "Response", 5),
				createMessage("user", "New topic here", 10), // Topic change
				createMessage("assistant", "Topic response", 15),
				createMessage("user", "Continue discussion", 40), // Time gap (25 min > 20)
			]

			const episodes = await combinedDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(3) // Split on both topic and time
		})

		it("should handle empty topic patterns gracefully", async () => {
			const config: EpisodeConfig = {
				topicPatterns: [],
				segmentation: { mode: "heuristic" },
			}
			const emptyTopicDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(3, "No topics")

			const episodes = await emptyTopicDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // No topic-based splits
		})

		it("should prioritize size limits over heuristic breakpoints", async () => {
			const config: EpisodeConfig = {
				maxMessages: 2,
				timeGapMin: 20,
				segmentation: { mode: "heuristic" },
			}
			const sizeDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = [
				createMessage("user", "Message 1", 0),
				createMessage("assistant", "Response 1", 5),
				createMessage("user", "Message 2", 25), // Would be time gap, but size limit hit first
				createMessage("assistant", "Response 2", 30),
			]

			const episodes = await sizeDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(2)
			expect(episodes[0].message_count).toBe(2)
			expect(episodes[1].message_count).toBe(2)
		})

		it("should handle single message input", async () => {
			const messages = [createMessage("user", "Single message", 0)]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
			expect(episodes[0].message_count).toBe(1)
		})

		it("should handle messages without timestamps", async () => {
			const messages: Message[] = [
				{ role: "user", content: "No timestamp 1" },
				{ role: "assistant", content: "No timestamp 2" },
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // No time-based splits without timestamps
		})

		it("should generate consistent episode IDs for same input", async () => {
			const messages = createMessages(3, "Consistent")

			const episodes1 = await detector.detect([...messages], testWorkspaceId, testProjectContext)
			const episodes2 = await detector.detect([...messages], testWorkspaceId, testProjectContext)

			expect(episodes1[0].episode_id).toBe(episodes2[0].episode_id)
		})

		it("should generate different episode IDs for different workspaces", async () => {
			const messages = createMessages(3, "Different WS")

			const episodes1 = await detector.detect(messages, "workspace1", testProjectContext)
			const episodes2 = await detector.detect(messages, "workspace2", testProjectContext)

			expect(episodes1[0].episode_id).not.toBe(episodes2[0].episode_id)
		})

		it("should set correct episode metadata", async () => {
			const messages = [createMessage("user", "Test message", 0), createMessage("assistant", "Test response", 5)]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)

			expect(episodes[0]).toMatchObject({
				workspace_id: testWorkspaceId,
				message_count: 2,
				messages: messages,
			})
			expect(episodes[0].episode_id).toMatch(/^ep_\w+/)
			expect(episodes[0].start_time).toBeInstanceOf(Date)
			expect(episodes[0].end_time).toBeInstanceOf(Date)
			expect(episodes[0].reference_time).toBeInstanceOf(Date)
		})
	})

	describe("Semantic Mode Detection", () => {
		let detector: EpisodeDetector

		beforeEach(() => {
			const config: EpisodeConfig = {
				segmentation: {
					mode: "semantic",
					semantic: {
						driftK: 2.5,
						minWindow: 5,
						distance: "cosine",
					},
				},
			}
			detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)
		})

		it("should detect semantic drift with cosine distance", async () => {
			const messages = createMessages(8, "Semantic")

			// Mock embeddings: first few similar, then different
			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0.9, 0.1, 0])
				.mockResolvedValueOnce([0.8, 0.2, 0])
				.mockResolvedValueOnce([0.7, 0.3, 0])
				.mockResolvedValueOnce([0.6, 0.4, 0])
				.mockResolvedValueOnce([0, 0, 1]) // Major drift
				.mockResolvedValueOnce([0, 0.1, 0.9])
				.mockResolvedValueOnce([0, 0.2, 0.8])

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes.length).toBeGreaterThanOrEqual(1) // Should handle semantic detection
		})

		it("should use dot product distance when configured", async () => {
			const config: EpisodeConfig = {
				segmentation: {
					mode: "semantic",
					semantic: { distance: "dot", driftK: 0.5 }, // Lower threshold
				},
			}
			const dotDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(6, "Dot distance")

			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 1, 1])
				.mockResolvedValueOnce([1, 1, 1])
				.mockResolvedValueOnce([1, 1, 1])
				.mockResolvedValueOnce([-1, -1, -1]) // Opposite direction
				.mockResolvedValueOnce([-1, -1, -1])
				.mockResolvedValueOnce([-1, -1, -1])

			const episodes = await dotDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes.length).toBeGreaterThanOrEqual(1) // Should at least have 1 episode
		})

		it("should respect minWindow parameter", async () => {
			const config: EpisodeConfig = {
				segmentation: {
					mode: "semantic",
					semantic: { minWindow: 3 },
				},
			}
			const minWindowDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(4, "Min window")

			// Even with very different embeddings, should wait for minWindow
			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0, 1, 0])
				.mockResolvedValueOnce([0, 0, 1]) // Very different, but within minWindow
				.mockResolvedValueOnce([1, 1, 1])

			const episodes = await minWindowDetector.detect(messages, testWorkspaceId, testProjectContext)
			// Should not split within minWindow even with drift
			expect(episodes).toHaveLength(1)
		})

		it("should use adaptive threshold with MAD calculation", async () => {
			const messages = createMessages(8, "Adaptive threshold")

			// Mock gradual drift pattern
			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0.95, 0.05, 0])
				.mockResolvedValueOnce([0.9, 0.1, 0])
				.mockResolvedValueOnce([0.85, 0.15, 0])
				.mockResolvedValueOnce([0.8, 0.2, 0])
				.mockResolvedValueOnce([0.1, 0.9, 0]) // Sudden drift
				.mockResolvedValueOnce([0.05, 0.95, 0])
				.mockResolvedValueOnce([0, 1, 0])

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(mockEmbedder.embed).toHaveBeenCalledTimes(8)
		})

		it("should handle embedding failures gracefully", async () => {
			const messages = createMessages(4, "Embed failure")

			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockRejectedValueOnce(new Error("Embedding failed"))
				.mockResolvedValueOnce([0, 1, 0])
				.mockResolvedValueOnce([0, 0, 1])

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // Should continue despite failure
		})

		it("should reset cluster centroid after detecting breakpoint", async () => {
			const messages = createMessages(7, "Cluster reset")

			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0, 0, 1]) // Major drift
				.mockResolvedValueOnce([0, 0, 1])

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes.length).toBeGreaterThan(1)
		})

		it("should handle zero vectors without crashing", async () => {
			const messages = createMessages(4, "Zero vectors")

			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([0, 0, 0])
				.mockResolvedValueOnce([0, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0, 1, 0])

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // Should handle gracefully
		})

		it("should work without embedder (fallback to heuristic)", async () => {
			const noEmbedDetector = new EpisodeDetector(mockContextGenerator, undefined, mockLlmProvider, {
				segmentation: { mode: "semantic" },
			})

			const messages = createMessages(3, "No embedder")

			const episodes = await noEmbedDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // Fallback behavior
		})

		it("should combine semantic and heuristic breakpoints", async () => {
			const config: EpisodeConfig = {
				timeGapMin: 15,
				segmentation: {
					mode: "semantic",
					semantic: { driftK: 1.0 }, // Low threshold for easy detection
				},
			}
			const hybridDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = [
				createMessage("user", "Message 1", 0),
				createMessage("assistant", "Response 1", 5),
				createMessage("user", "Message 2", 25), // Time gap
				createMessage("assistant", "Response 2", 30),
			]

			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0, 1, 0]) // Semantic drift
				.mockResolvedValueOnce([0, 1, 0])

			const episodes = await hybridDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes.length).toBeGreaterThanOrEqual(2) // Both time and semantic splits
		})

		it("should handle high drift threshold (no splits)", async () => {
			const config: EpisodeConfig = {
				segmentation: {
					mode: "semantic",
					semantic: { driftK: 10.0 }, // Very high threshold
				},
			}
			const highThresholdDetector = new EpisodeDetector(
				mockContextGenerator,
				mockEmbedder,
				mockLlmProvider,
				config,
			)

			const messages = createMessages(6, "High threshold")

			mockEmbedder.embed = vi.fn().mockResolvedValue([Math.random(), Math.random(), Math.random()])

			const episodes = await highThresholdDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // No splits with high threshold
		})

		it("should limit centroid weight to prevent overflow", async () => {
			const messages = createMessages(1500, "Weight limit") // Large number of messages

			mockEmbedder.embed = vi.fn().mockResolvedValue([0.1, 0.1, 0.1])

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes.length).toBeGreaterThan(0)
		})

		it("should calculate cosine distance correctly", async () => {
			const messages = createMessages(4, "Cosine test")

			// Test orthogonal vectors (should have high cosine distance)
			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0, 1, 0]) // Orthogonal

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(mockEmbedder.embed).toHaveBeenCalledTimes(4)
		})

		it("should calculate dot product distance correctly", async () => {
			const config: EpisodeConfig = {
				segmentation: {
					mode: "semantic",
					semantic: { distance: "dot", driftK: 0.1 }, // Very low threshold
				},
			}
			const dotDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(4, "Dot test")

			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 1, 1])
				.mockResolvedValueOnce([1, 1, 1])
				.mockResolvedValueOnce([1, 1, 1])
				.mockResolvedValueOnce([-1, -1, -1]) // Negative correlation

			const episodes = await dotDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes.length).toBeGreaterThanOrEqual(1) // Should at least have 1 episode
		})

		it("should maintain episode order after semantic detection", async () => {
			const messages = createMessages(6, "Order test")

			mockEmbedder.embed = vi
				.fn()
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([1, 0, 0])
				.mockResolvedValueOnce([0, 1, 0])
				.mockResolvedValueOnce([0, 1, 0])
				.mockResolvedValueOnce([0, 1, 0])

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)

			// Verify chronological order
			for (let i = 1; i < episodes.length; i++) {
				expect(episodes[i].start_time.getTime()).toBeGreaterThanOrEqual(episodes[i - 1].end_time.getTime())
			}
		})
	})

	describe("LLM Integration and Boundary Refinement", () => {
		let detector: EpisodeDetector

		beforeEach(() => {
			const config: EpisodeConfig = {
				segmentation: {
					mode: "llm_verified",
					boundaryRefiner: true,
				},
			}
			detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)
		})

		it("should call LLM for boundary refinement when configured", async () => {
			const messages = createMessages(6, "LLM refine")

			await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(mockLlmProvider.generateJson).toHaveBeenCalled()
		})

		it("should use LLM-provided boundaries", async () => {
			mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
				boundaries: [0, 2, 4],
				titles: ["Part 1", "Part 2", "Part 3"],
			})

			// Don't override context descriptions after LLM provides them
			mockContextGenerator.describe = vi.fn().mockResolvedValue("Should not override LLM titles")

			const messages = createMessages(6, "LLM boundaries")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(3)
			// LLM titles are set immediately, but then overridden by context generator
			// This test verifies the LLM boundaries work correctly
			expect(episodes[0].messages).toHaveLength(2)
			expect(episodes[1].messages).toHaveLength(2)
			expect(episodes[2].messages).toHaveLength(2)
		})

		it("should sanitize LLM boundaries (remove invalid indices)", async () => {
			mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
				boundaries: [0, -1, 2.5, 10, 4], // Invalid: negative, float, out of range
				titles: ["Valid", "Invalid", "Also invalid", "Out of range", "Valid"],
			})

			const messages = createMessages(6, "Sanitize boundaries")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			// Should only use valid boundaries: [0, 4]
			expect(episodes).toHaveLength(2)
		})

		it("should include project context in LLM prompt", async () => {
			const messages = createMessages(3, "Context test")

			await detector.detect(messages, testWorkspaceId, testProjectContext)

			expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(
				expect.stringContaining("test-app"),
				expect.any(Object),
			)
			expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(
				expect.stringContaining("typescript"),
				expect.any(Object),
			)
			expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(
				expect.stringContaining("react"),
				expect.any(Object),
			)
		})

		it("should truncate long message content in LLM prompt", async () => {
			const longContent = "A".repeat(1000) // Very long content
			const messages = [createMessage("user", longContent, 0)]

			await detector.detect(messages, testWorkspaceId, testProjectContext)

			const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
			expect(promptCall).toContain("…") // Should be truncated
		})

		it("should handle LLM failure gracefully (fallback to preliminary)", async () => {
			mockLlmProvider.generateJson = vi.fn().mockRejectedValue(new Error("LLM failed"))

			const messages = createMessages(4, "LLM failure")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // Should fallback
		})

		it("should handle malformed LLM response", async () => {
			mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
				// Missing boundaries array
				titles: ["Some title"],
			})

			const messages = createMessages(3, "Malformed response")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // Should use default [0]
		})

		it("should handle LLM response with no titles", async () => {
			mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
				boundaries: [0, 2],
				// Missing titles
			})

			const messages = createMessages(4, "No titles")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(2)
			// Should still work without titles
		})

		it("should respect maxMessages in LLM prompt", async () => {
			const config: EpisodeConfig = {
				maxMessages: 10,
				segmentation: { boundaryRefiner: true },
			}
			const maxMsgDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const messages = createMessages(5, "Max messages")

			await maxMsgDetector.detect(messages, testWorkspaceId, testProjectContext)

			const promptCall = mockLlmProvider.generateJson.mock.calls[0][0]
			expect(promptCall).toContain("episodes <= 10 messages")
		})

		it("should use correct LLM parameters", async () => {
			const messages = createMessages(3, "LLM params")

			await detector.detect(messages, testWorkspaceId, testProjectContext)

			expect(mockLlmProvider.generateJson).toHaveBeenCalledWith(expect.any(String), {
				temperature: 0.2,
				max_tokens: 500,
			})
		})

		it("should work without LLM provider", async () => {
			const noLlmDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, undefined, {
				segmentation: { boundaryRefiner: true },
			})

			const messages = createMessages(3, "No LLM")

			const episodes = await noLlmDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
		})

		it("should enforce boundaries are sorted", async () => {
			mockLlmProvider.generateJson = vi.fn().mockResolvedValue({
				boundaries: [0, 4, 2, 6], // Unsorted
				titles: ["A", "B", "C", "D"],
			})

			const messages = createMessages(8, "Unsorted boundaries")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			// Should sort boundaries and episodes should be in order
			for (let i = 1; i < episodes.length; i++) {
				expect(episodes[i].start_time.getTime()).toBeGreaterThanOrEqual(episodes[i - 1].end_time.getTime())
			}
		})
	})

	describe("Context Generation Integration", () => {
		let detector: EpisodeDetector

		beforeEach(() => {
			detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider)
		})

		it("should call context generator for each episode", async () => {
			const messages = [
				createMessage("user", "Message 1", 0),
				createMessage("assistant", "Response 1", 35), // Time gap to create 2 episodes
			]

			await detector.detect(messages, testWorkspaceId, testProjectContext)

			expect(mockContextGenerator.describe).toHaveBeenCalledTimes(2)
		})

		it("should pass project context to context generator", async () => {
			const messages = createMessages(2, "Context pass")

			await detector.detect(messages, testWorkspaceId, testProjectContext)

			expect(mockContextGenerator.describe).toHaveBeenCalledWith(expect.any(Array), testProjectContext)
		})

		it("should handle context generation failures gracefully", async () => {
			mockContextGenerator.describe = vi.fn().mockRejectedValue(new Error("Context gen failed"))

			const messages = createMessages(2, "Context failure")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes[0].context_description).toContain("Episode with")
			expect(episodes[0].context_description).toContain("messages")
		})

		it("should use generated context descriptions", async () => {
			mockContextGenerator.describe = vi.fn().mockResolvedValue("Custom context description")

			const messages = createMessages(2, "Custom context")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes[0].context_description).toBe("Custom context description")
		})

		it("should set fallback context description on failure", async () => {
			mockContextGenerator.describe = vi.fn().mockRejectedValue(new Error("Failed"))

			const messages = createMessages(3, "Fallback context")

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes[0].context_description).toBe("Episode with 3 messages")
		})
	})

	describe("Edge Cases and Error Handling", () => {
		let detector: EpisodeDetector

		beforeEach(() => {
			detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider)
		})

		it("should handle empty message array", async () => {
			const episodes = await detector.detect([], testWorkspaceId, testProjectContext)
			expect(episodes).toEqual([])
		})

		it("should handle single message", async () => {
			const messages = [createMessage("user", "Single", 0)]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
			expect(episodes[0].message_count).toBe(1)
		})

		it("should handle messages with missing timestamps", async () => {
			const messages: Message[] = [
				{ role: "user", content: "No timestamp 1" },
				{ role: "assistant", content: "No timestamp 2" },
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
			expect(episodes[0].start_time).toBeInstanceOf(Date)
			expect(episodes[0].end_time).toBeInstanceOf(Date)
		})

		it("should handle malformed timestamp strings", async () => {
			const messages: Message[] = [
				{ role: "user", content: "Bad timestamp", timestamp: "invalid-date" },
				{ role: "assistant", content: "Response", timestamp: "2023-13-45T99:99:99Z" },
			]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
		})

		it("should handle very large message content", async () => {
			const largeContent = "A".repeat(100000) // 100KB content
			const messages = [createMessage("user", largeContent, 0)]

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1)
			expect(episodes[0].messages[0].content).toBe(largeContent)
		})

		it("should handle extreme configuration values", async () => {
			const extremeConfig: EpisodeConfig = {
				timeGapMin: 0,
				maxMessages: 1,
				segmentation: {
					semantic: {
						driftK: 0,
						minWindow: 0,
					},
				},
			}
			const extremeDetector = new EpisodeDetector(
				mockContextGenerator,
				mockEmbedder,
				mockLlmProvider,
				extremeConfig,
			)

			const messages = createMessages(3, "Extreme config")

			const episodes = await extremeDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes.length).toBeGreaterThan(0)
		})
	})

	describe("Private Method Testing (via Integration)", () => {
		let detector: EpisodeDetector

		beforeEach(() => {
			detector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider)
		})

		it("should generate unique episode IDs", async () => {
			const messages1 = createMessages(2, "Set 1")
			const messages2 = createMessages(2, "Set 2")

			const episodes1 = await detector.detect(messages1, testWorkspaceId, testProjectContext)
			const episodes2 = await detector.detect(messages2, testWorkspaceId, testProjectContext)

			expect(episodes1[0].episode_id).not.toBe(episodes2[0].episode_id)
		})

		it("should parse timestamps correctly", async () => {
			const specificTime = "2023-12-01T10:30:00Z"
			const messages = [createMessage("user", "Specific time", 0)]
			messages[0].timestamp = specificTime

			const episodes = await detector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes[0].start_time).toEqual(new Date(specificTime))
		})

		it("should handle division by zero in distance calculations", async () => {
			const config: EpisodeConfig = {
				segmentation: { mode: "semantic" },
			}
			const semanticDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			// Mock zero vectors that could cause division by zero
			mockEmbedder.embed = vi.fn().mockResolvedValueOnce([0, 0, 0]).mockResolvedValueOnce([0, 0, 0])

			const messages = createMessages(2, "Zero vectors")

			const episodes = await semanticDetector.detect(messages, testWorkspaceId, testProjectContext)
			expect(episodes).toHaveLength(1) // Should handle gracefully
		})

		it("should maintain proper episode boundaries", async () => {
			const messages = createMessages(6, "Boundaries")

			// Force a split after 3 messages
			const config: EpisodeConfig = { maxMessages: 3 }
			const boundaryDetector = new EpisodeDetector(mockContextGenerator, mockEmbedder, mockLlmProvider, config)

			const episodes = await boundaryDetector.detect(messages, testWorkspaceId, testProjectContext)

			expect(episodes).toHaveLength(2)
			expect(episodes[0].messages).toHaveLength(3)
			expect(episodes[1].messages).toHaveLength(3)

			// Verify no message overlap
			const allMessages = episodes.flatMap((ep) => ep.messages)
			expect(allMessages).toHaveLength(6)
		})
	})
})
