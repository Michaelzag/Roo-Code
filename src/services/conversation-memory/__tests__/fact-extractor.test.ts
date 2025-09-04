import { describe, it, expect, vi, beforeEach } from "vitest"
import { ConversationFactExtractor } from "../processors/fact-extractor"
import type { ILlmProvider } from "../interfaces"
import type { Message, ProjectContext } from "../types"

describe("ConversationFactExtractor", () => {
	let extractor: ConversationFactExtractor
	let mockLlm: ILlmProvider
	let testMessages: Message[]
	let testProject: ProjectContext

	beforeEach(() => {
		mockLlm = {
			generateJson: vi.fn(),
		}

		testMessages = [
			{
				role: "user",
				content: "How do I implement authentication in my app?",
			},
			{
				role: "assistant",
				content: "You can use JWT tokens with express-session middleware.",
			},
		]

		testProject = {
			workspaceName: "test-project",
			language: "typescript",
			framework: "express",
			packageManager: "npm",
		}
	})

	describe("with LLM provider", () => {
		beforeEach(() => {
			extractor = new ConversationFactExtractor(mockLlm)
		})

		it("should extract facts using LLM with correct prompt format", async () => {
			const mockResponse = {
				facts: [
					{
						content: "User wants to implement authentication",
						category: "architecture",
						confidence: 0.9,
					},
					{
						content: "JWT tokens recommended for authentication",
						category: "pattern",
						confidence: 0.85,
					},
				],
			}

			vi.mocked(mockLlm.generateJson).mockResolvedValue(mockResponse)

			const facts = await extractor.extractFacts(testMessages, testProject)

			expect(mockLlm.generateJson).toHaveBeenCalledWith(
				expect.stringContaining("typescript project"),
				expect.objectContaining({
					temperature: 0.1,
					max_tokens: 1500,
				}),
			)
			expect(facts).toHaveLength(2)
			expect(facts[0].content).toBe("User wants to implement authentication")
			expect(facts[0].category).toBe("architecture")
			expect(facts[0].confidence).toBe(0.9)
		})

		it("should extract facts with provider override using extractFactsWithProvider", async () => {
			const mockResponse = {
				facts: [
					{
						content: "Custom provider extraction",
						category: "infrastructure",
						confidence: 0.95,
					},
				],
			}

			const customLlm: ILlmProvider = {
				generateJson: vi.fn().mockResolvedValue(mockResponse),
			}

			const facts = await extractor.extractFactsWithProvider(testMessages, testProject, customLlm)

			expect(customLlm.generateJson).toHaveBeenCalled()
			expect(facts).toHaveLength(1)
			expect(facts[0].content).toBe("Custom provider extraction")
			expect(facts[0].category).toBe("infrastructure")
		})

		it("should return empty array on LLM error in extractFactsWithProvider", async () => {
			const errorLlm: ILlmProvider = {
				generateJson: vi.fn().mockRejectedValue(new Error("LLM error")),
			}

			const facts = await extractor.extractFactsWithProvider(testMessages, testProject, errorLlm)

			expect(facts).toEqual([])
		})

		it("should filter out empty content", async () => {
			const mockResponse = {
				facts: [
					{
						content: "Valid fact",
						category: "pattern",
						confidence: 0.9,
					},
					{
						content: "", // Empty content
						category: "pattern",
						confidence: 0.8,
					},
					{
						content: "  ", // Whitespace only
						category: "debugging",
						confidence: 0.7,
					},
				],
			}

			vi.mocked(mockLlm.generateJson).mockResolvedValue(mockResponse)

			const facts = await extractor.extractFacts(testMessages, testProject)

			expect(facts).toHaveLength(1)
			expect(facts[0].content).toBe("Valid fact")
		})

		it("should normalize confidence values", async () => {
			const mockResponse = {
				facts: [
					{
						content: "Over-confident fact",
						category: "pattern",
						confidence: 1.5, // Above 1
					},
					{
						content: "Under-confident fact",
						category: "debugging",
						confidence: -0.5, // Below 0
					},
					{
						content: "Missing confidence fact",
						category: "infrastructure",
						// No confidence property
					},
				],
			}

			vi.mocked(mockLlm.generateJson).mockResolvedValue(mockResponse)

			const facts = await extractor.extractFacts(testMessages, testProject)

			expect(facts[0].confidence).toBe(1) // Clamped to 1
			expect(facts[1].confidence).toBe(0) // Clamped to 0
			expect(facts[2].confidence).toBe(0.7) // Default value
		})

		it("should handle invalid category values", async () => {
			const mockResponse = {
				facts: [
					{
						content: "Valid fact",
						category: "infrastructure",
						confidence: 0.9,
					},
					{
						content: "Invalid category fact",
						category: "invalid-category",
						confidence: 0.8,
					},
					{
						content: "Missing category fact",
						confidence: 0.7,
						// No category property
					},
				],
			}

			vi.mocked(mockLlm.generateJson).mockResolvedValue(mockResponse)

			const facts = await extractor.extractFacts(testMessages, testProject)

			expect(facts[0].category).toBe("infrastructure")
			expect(facts[1].category).toBe("pattern") // Default fallback
			expect(facts[2].category).toBe("pattern") // Default fallback
		})

		it("should fall back to heuristic extraction on LLM error", async () => {
			vi.mocked(mockLlm.generateJson).mockRejectedValue(new Error("LLM error"))

			const errorMessages: Message[] = [
				{
					role: "user",
					content: "I got an error: TypeError cannot read property",
				},
			]

			const facts = await extractor.extractFacts(errorMessages, testProject)

			expect(facts.length).toBeGreaterThan(0)
			expect(facts.some((f) => f.category === "debugging")).toBe(true)
		})

		it("should handle malformed JSON response", async () => {
			vi.mocked(mockLlm.generateJson).mockResolvedValue({
				// Missing facts array
				other: "data",
			})

			const facts = await extractor.extractFacts(testMessages, testProject)

			// Should fall back to heuristic extraction
			expect(Array.isArray(facts)).toBe(true)
		})
	})

	describe("without LLM provider (heuristic only)", () => {
		beforeEach(() => {
			extractor = new ConversationFactExtractor()
		})

		it("should extract debugging facts from error mentions", async () => {
			const errorMessages: Message[] = [
				{
					role: "user",
					content: "I keep getting TypeError when calling the API",
				},
			]

			const facts = await extractor.extractFacts(errorMessages, testProject)

			expect(
				facts.some((f) => f.category === "debugging" && f.content === "Active debugging context detected"),
			).toBe(true)
		})

		it("should extract architecture facts from auth mentions", async () => {
			const authMessages: Message[] = [
				{
					role: "assistant",
					content: "You should implement JWT authentication here",
				},
			]

			const facts = await extractor.extractFacts(authMessages, testProject)

			expect(
				facts.some((f) => f.category === "architecture" && f.content === "Authentication approach discussed"),
			).toBe(true)
		})

		it("should extract infrastructure facts from frontend framework mentions", async () => {
			const frontendMessages: Message[] = [
				{
					role: "user",
					content: "We should use React for this project",
				},
			]

			const facts = await extractor.extractFacts(frontendMessages, testProject)

			expect(
				facts.some((f) => f.category === "infrastructure" && f.content === "Frontend framework selected"),
			).toBe(true)
		})

		it("should extract infrastructure facts from database mentions", async () => {
			const dbMessages: Message[] = [
				{
					role: "user",
					content: "We should use PostgreSQL for this project",
				},
			]

			const facts = await extractor.extractFacts(dbMessages, testProject)

			expect(
				facts.some((f) => f.category === "infrastructure" && f.content === "Database technology decision"),
			).toBe(true)
		})

		it("should handle multiple keyword matches in same message", async () => {
			const complexMessages: Message[] = [
				{
					role: "user",
					content: "We use React with PostgreSQL and JWT authentication, but got an error",
				},
			]

			const facts = await extractor.extractFacts(complexMessages, testProject)

			// Should extract multiple facts from the same message
			expect(facts.length).toBeGreaterThanOrEqual(3)
			expect(facts.some((f) => f.category === "infrastructure")).toBe(true)
			expect(facts.some((f) => f.category === "architecture")).toBe(true)
			expect(facts.some((f) => f.category === "debugging")).toBe(true)
		})

		it("should handle empty messages gracefully", async () => {
			const emptyMessages: Message[] = []

			const facts = await extractor.extractFacts(emptyMessages, testProject)

			expect(facts).toEqual([])
		})

		it("should handle messages with undefined content", async () => {
			const badMessages: Message[] = [
				{
					role: "user",
					content: undefined as any,
				},
				{
					role: "assistant",
					content: "Valid content here",
				},
			]

			const facts = await extractor.extractFacts(badMessages, testProject)

			expect(facts.length).toBeGreaterThanOrEqual(0)
			// Should not throw error
		})

		it("should assign appropriate confidence levels for heuristic extraction", async () => {
			const testMessages: Message[] = [
				{
					role: "user",
					content: "React PostgreSQL JWT error",
				},
			]

			const facts = await extractor.extractFacts(testMessages, testProject)

			facts.forEach((fact) => {
				expect(fact.confidence).toBeGreaterThan(0)
				expect(fact.confidence).toBeLessThanOrEqual(1)
				// Infrastructure facts should have higher confidence
				if (fact.category === "infrastructure") {
					expect(fact.confidence).toBeGreaterThanOrEqual(0.6)
				}
			})
		})
	})

	describe("prompt building", () => {
		beforeEach(() => {
			extractor = new ConversationFactExtractor(mockLlm)
		})

		it("should include project context in prompt", async () => {
			vi.mocked(mockLlm.generateJson).mockResolvedValue({ facts: [] })

			await extractor.extractFacts(testMessages, testProject)

			const promptCall = vi.mocked(mockLlm.generateJson).mock.calls[0][0]
			expect(promptCall).toContain("typescript project")
			expect(promptCall).toContain("test-project")
			expect(promptCall).toContain("express")
			expect(promptCall).toContain("npm")
		})

		it("should include conversation content in prompt", async () => {
			vi.mocked(mockLlm.generateJson).mockResolvedValue({ facts: [] })

			await extractor.extractFacts(testMessages, testProject)

			const promptCall = vi.mocked(mockLlm.generateJson).mock.calls[0][0]
			expect(promptCall).toContain("implement authentication")
			expect(promptCall).toContain("JWT tokens")
		})

		it("should truncate very long conversations", async () => {
			const longMessages: Message[] = Array.from({ length: 100 }, (_, i) => ({
				role: i % 2 === 0 ? "user" : ("assistant" as const),
				content: `This is message ${i} with lots of content `.repeat(50),
			}))

			vi.mocked(mockLlm.generateJson).mockResolvedValue({ facts: [] })

			await extractor.extractFacts(longMessages, testProject)

			const promptCall = vi.mocked(mockLlm.generateJson).mock.calls[0][0]
			// Should be truncated to ~4000 characters
			expect(promptCall.length).toBeLessThan(5000)
		})
	})
})
