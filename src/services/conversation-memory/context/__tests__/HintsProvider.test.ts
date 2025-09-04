import type { HintsProvider } from "../../interfaces/episode"
import type { ProjectContext } from "../../types"
import type { IVectorStore, VectorRecord } from "../../interfaces"
import { FileSystemHintsProvider, MemoryHintsProvider, AutoHintsProvider } from "../HintsProvider"

// Mock fs/promises module
vi.mock("fs/promises", () => ({
	readFile: vi.fn(),
	readdir: vi.fn(),
}))

// Import the mocked fs module
import * as fs from "fs/promises"

/**
 * Comprehensive test suite for HintsProvider classes following established patterns.
 *
 * This test suite covers all three provider implementations:
 * - FileSystemHintsProvider: File system operations, manifest parsing, directory listing
 * - MemoryHintsProvider: Vector store interaction, dependency resolution, memory retrieval
 * - AutoHintsProvider: Intelligent source selection, fallback mechanisms, priority logic
 *
 * Test areas covered:
 * - Core functionality (getHints method implementations)
 * - File system operations (package.json, requirements.txt, Cargo.toml parsing)
 * - Vector store integration (fact retrieval, tag extraction)
 * - Error handling (file system errors, vector store failures, parsing errors)
 * - Edge cases (empty results, malformed files, missing dependencies)
 * - Integration scenarios (provider combinations, fallback logic)
 */
describe("HintsProvider", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeEach(() => {
		// Spy on console methods to verify logging behavior
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		// Reset all mocks before each test
		vi.clearAllMocks()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	describe("FileSystemHintsProvider", () => {
		let provider: FileSystemHintsProvider
		const testWorkspacePath = "/test/workspace"
		const testExtra = ["custom", "hint"]

		beforeEach(() => {
			provider = new FileSystemHintsProvider(testWorkspacePath, testExtra)
		})

		describe("Constructor", () => {
			it("should initialize with workspace path and extra hints", () => {
				expect(provider).toBeInstanceOf(FileSystemHintsProvider)
			})

			it("should work without extra hints", () => {
				const providerWithoutExtra = new FileSystemHintsProvider(testWorkspacePath)
				expect(providerWithoutExtra).toBeInstanceOf(FileSystemHintsProvider)
			})
		})

		describe("getHints", () => {
			it("should return hints with deps, dirs, and extra", async () => {
				// Mock successful file operations
				const mockPackageJson = {
					dependencies: { react: "^18.0.0" },
					devDependencies: { typescript: "^4.0.0" },
				}
				const mockDirEntries = [
					{ isDirectory: () => true, name: "src" },
					{ isDirectory: () => true, name: "dist" }, // Should be filtered
					{ isDirectory: () => false, name: "package.json" },
				]

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})
				vi.mocked(fs.readdir).mockResolvedValue(mockDirEntries as any)

				const result = await provider.getHints()

				expect(result).toEqual({
					deps: ["react", "typescript"],
					dirs: ["src"],
					extra: testExtra,
				})
			})

			it("should handle missing package.json gracefully", async () => {
				vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"))
				vi.mocked(fs.readdir).mockResolvedValue([])

				const result = await provider.getHints()

				expect(result).toEqual({
					deps: [],
					dirs: [],
					extra: testExtra,
				})
			})

			it("should pass through project context parameter", async () => {
				const projectContext: ProjectContext = {
					workspaceName: "test-project",
					language: "typescript",
				}

				vi.mocked(fs.readFile).mockRejectedValue(new Error("ENOENT"))
				vi.mocked(fs.readdir).mockResolvedValue([])

				const result = await provider.getHints(projectContext)

				expect(result).toEqual({
					deps: [],
					dirs: [],
					extra: testExtra,
				})
			})
		})

		describe("Package.json dependency parsing", () => {
			beforeEach(() => {
				vi.mocked(fs.readdir).mockResolvedValue([])
			})

			it("should parse valid package.json with both dependencies and devDependencies", async () => {
				const mockPackageJson = {
					dependencies: { react: "^18.0.0", lodash: "^4.17.21" },
					devDependencies: { typescript: "^4.0.0", jest: "^28.0.0" },
				}

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual(["react", "lodash", "typescript", "jest"])
			})

			it("should handle package.json with only dependencies", async () => {
				const mockPackageJson = {
					dependencies: { react: "^18.0.0" },
				}

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual(["react"])
			})

			it("should handle package.json with only devDependencies", async () => {
				const mockPackageJson = {
					devDependencies: { typescript: "^4.0.0" },
				}

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual(["typescript"])
			})

			it("should handle package.json with no dependencies", async () => {
				const mockPackageJson = { name: "test-package", version: "1.0.0" }

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual([])
			})

			it("should handle malformed package.json", async () => {
				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve("invalid json content")
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual([])
			})

			it("should limit dependencies to 20 items", async () => {
				const largeDepsObject = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`dep${i}`, "^1.0.0"]))
				const mockPackageJson = { dependencies: largeDepsObject }

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toHaveLength(20)
			})
		})

		describe("Requirements.txt parsing", () => {
			beforeEach(() => {
				vi.mocked(fs.readdir).mockResolvedValue([])
			})

			it("should parse valid requirements.txt", async () => {
				const mockRequirements = "django==4.1.0\nrequests>=2.28.0\nnumpy~=1.21.0\n# comment line\npandas"

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("requirements.txt")) {
						return Promise.resolve(mockRequirements)
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual(["django", "requests", "numpy", "pandas"])
			})

			it("should handle empty requirements.txt", async () => {
				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("requirements.txt")) {
						return Promise.resolve("")
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual([])
			})

			it("should filter out comments and empty lines from requirements.txt", async () => {
				const mockRequirements = "django==4.1.0\n# This is a comment\n\nrequests>=2.28.0\n#another comment"

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("requirements.txt")) {
						return Promise.resolve(mockRequirements)
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual(["django", "requests"])
			})
		})

		describe("Cargo.toml parsing", () => {
			beforeEach(() => {
				vi.mocked(fs.readdir).mockResolvedValue([])
			})

			it("should parse valid Cargo.toml dependencies", async () => {
				const mockCargoToml = `[package]
name = "test-project"
version = "0.1.0"

[dependencies]
serde = "1.0"
tokio = { version = "1.0", features = ["full"] }
reqwest = "0.11"

[dev-dependencies]
test-dep = "1.0"`

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("Cargo.toml")) {
						return Promise.resolve(mockCargoToml)
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual(["serde", "tokio"])
			})

			it("should handle Cargo.toml without dependencies section", async () => {
				const mockCargoToml = `[package]
name = "test-project"
version = "0.1.0"`

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("Cargo.toml")) {
						return Promise.resolve(mockCargoToml)
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual([])
			})

			it("should filter out comments from Cargo.toml dependencies", async () => {
				const mockCargoToml = `[dependencies]
serde = "1.0"
# tokio = "1.0"  # commented out
reqwest = "0.11"`

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("Cargo.toml")) {
						return Promise.resolve(mockCargoToml)
					}
					return Promise.reject(new Error("File not found"))
				})

				const result = await provider.getHints()

				expect(result.deps).toEqual(["serde", "reqwest"])
			})
		})

		describe("Directory listing", () => {
			beforeEach(() => {
				vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))
			})

			it("should list directories and filter out ignored ones", async () => {
				const mockDirEntries = [
					{ isDirectory: () => true, name: "src" },
					{ isDirectory: () => true, name: "lib" },
					{ isDirectory: () => true, name: "node_modules" }, // Should be filtered
					{ isDirectory: () => true, name: ".git" }, // Should be filtered
					{ isDirectory: () => true, name: "dist" }, // Should be filtered
					{ isDirectory: () => false, name: "package.json" }, // Should be filtered (not directory)
				]

				vi.mocked(fs.readdir).mockResolvedValue(mockDirEntries as any)

				const result = await provider.getHints()

				expect(result.dirs).toEqual(["src", "lib"])
			})

			it("should handle empty directory", async () => {
				vi.mocked(fs.readdir).mockResolvedValue([])

				const result = await provider.getHints()

				expect(result.dirs).toEqual([])
			})

			it("should handle directory read errors", async () => {
				vi.mocked(fs.readdir).mockRejectedValue(new Error("Permission denied"))

				const result = await provider.getHints()

				expect(result.dirs).toEqual([])
			})

			it("should limit directories to 10 items", async () => {
				const largeDirEntries = Array.from({ length: 15 }, (_, i) => ({
					isDirectory: () => true,
					name: `dir${i}`,
				}))

				vi.mocked(fs.readdir).mockResolvedValue(largeDirEntries as any)

				const result = await provider.getHints()

				expect(result.dirs).toHaveLength(10)
			})
		})
	})

	describe("MemoryHintsProvider", () => {
		let provider: MemoryHintsProvider
		let mockVectorStore: IVectorStore
		const testWorkspaceId = "test-workspace-123"

		beforeEach(() => {
			// Create comprehensive mock for vector store
			mockVectorStore = {
				ensureCollection: vi.fn(),
				collectionName: vi.fn().mockReturnValue("test-collection"),
				upsert: vi.fn(),
				insert: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
				get: vi.fn(),
				search: vi.fn(),
				filter: vi.fn(),
				clearCollection: vi.fn(),
				deleteCollection: vi.fn(),
			}

			provider = new MemoryHintsProvider(mockVectorStore, testWorkspaceId)
		})

		describe("Constructor", () => {
			it("should initialize with vector store and workspace ID", () => {
				expect(provider).toBeInstanceOf(MemoryHintsProvider)
			})
		})

		describe("getHints", () => {
			it("should return tags from infrastructure and pattern facts", async () => {
				const mockInfraFacts = [
					{
						id: "infra-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Using React components with TypeScript interfaces" },
					},
					{
						id: "infra-2",
						vector: [0.4, 0.5, 0.6],
						payload: { content: "Docker containers for microservices deployment" },
					},
				]
				const mockPatternFacts = [
					{
						id: "pattern-1",
						vector: [0.7, 0.8, 0.9],
						payload: { content: "Observer pattern implementation with EventEmitter" },
					},
					{
						id: "pattern-2",
						vector: [0.2, 0.3, 0.4],
						payload: { content: "Factory pattern for database connections" },
					},
				]

				vi.mocked(mockVectorStore.filter)!.mockImplementation((limit: number, filters: any) => {
					if (filters.category === "infrastructure") {
						return Promise.resolve(mockInfraFacts)
					}
					if (filters.category === "pattern") {
						return Promise.resolve(mockPatternFacts)
					}
					return Promise.resolve([])
				})

				const result = await provider.getHints()

				expect(result.tags).toEqual(
					expect.arrayContaining(["React", "TypeScript", "Docker", "Observer", "EventEmitter", "Factory"]),
				)
			})

			it("should handle vector store filter returning object with records", async () => {
				const mockResponse = {
					records: [
						{ id: "react-1", vector: [0.1, 0.2, 0.3], payload: { content: "Using React components" } },
					],
					nextCursor: "next-page",
				}

				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockResponse)

				const result = await provider.getHints()

				expect(result.tags).toEqual(expect.arrayContaining(["React"]))
			})

			it("should handle empty vector store results", async () => {
				vi.mocked(mockVectorStore.filter)?.mockResolvedValue([])

				const result = await provider.getHints()

				expect(result).toEqual({ tags: [] })
			})

			it("should handle vector store errors gracefully", async () => {
				vi.mocked(mockVectorStore.filter)?.mockRejectedValue(new Error("Vector store connection failed"))

				const result = await provider.getHints()

				expect(result).toEqual({ tags: [] })
			})

			it("should filter technical terms by length", async () => {
				const mockFacts = [
					{
						id: "fact-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Using A short XY VeryLongTechnicalTermThatShouldBeFiltered terms" },
					},
				]

				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				// Should exclude terms too short (A, XY) and too long (VeryLongTechnicalTermThatShouldBeFiltered)
				expect(result.tags).not.toContain("A")
				expect(result.tags).not.toContain("XY")
				expect(result.tags).not.toContain("VeryLongTechnicalTermThatShouldBeFiltered")
				expect(result.tags).toContain("Using")
			})

			it("should limit tags to 15 items", async () => {
				const longContent = Array.from({ length: 20 }, (_, i) => `Term${i}`).join(" ")
				const mockFacts = [{ id: "long-1", vector: [0.1, 0.2, 0.3], payload: { content: longContent } }]

				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				expect(result.tags).toHaveLength(15)
			})

			it("should pass workspace_path filter to vector store", async () => {
				vi.mocked(mockVectorStore.filter)?.mockResolvedValue([])

				await provider.getHints()

				expect(mockVectorStore.filter).toHaveBeenCalledWith(100, {
					workspace_path: testWorkspaceId,
					category: "infrastructure",
				})
				expect(mockVectorStore.filter).toHaveBeenCalledWith(100, {
					workspace_path: testWorkspaceId,
					category: "pattern",
				})
			})

			it("should handle missing vector store filter method", async () => {
				const limitedVectorStore = { ...mockVectorStore }
				delete limitedVectorStore.filter

				const limitedProvider = new MemoryHintsProvider(limitedVectorStore, testWorkspaceId)
				const result = await limitedProvider.getHints()

				expect(result).toEqual({ tags: [] })
			})

			it("should handle facts with missing payload", async () => {
				const mockFacts = [
					{ id: "null-1", vector: [0.1, 0.2, 0.3], payload: null },
					{ id: "undef-1", vector: [0.1, 0.2, 0.3], payload: undefined },
					{ id: "valid-1", vector: [0.1, 0.2, 0.3], payload: { content: "ValidContent" } },
					{ id: "missing-1", vector: [0.1, 0.2, 0.3], payload: {} }, // Empty payload instead of missing
				]

				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				expect(result.tags).toEqual(["ValidContent"])
			})

			it("should pass through project context parameter", async () => {
				const projectContext: ProjectContext = {
					workspaceName: "test-project",
					language: "typescript",
				}

				vi.mocked(mockVectorStore.filter)?.mockResolvedValue([])

				const result = await provider.getHints(projectContext)

				expect(result).toEqual({ tags: [] })
			})
		})

		describe("Technical term extraction", () => {
			it("should extract capitalized technical terms", async () => {
				const mockFacts = [
					{
						id: "react-ts-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "React components use TypeScript interfaces and Redux state" },
					},
				]

				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				expect(result.tags).toEqual(expect.arrayContaining(["React", "TypeScript", "Redux"]))
			})

			it("should handle mixed case and underscores", async () => {
				const mockFacts = [
					{
						id: "api-db-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "API_Gateway connects to Database_Connection via HTTP_Client" },
					},
				]

				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				expect(result.tags).toEqual(
					expect.arrayContaining(["API_Gateway", "Database_Connection", "HTTP_Client"]),
				)
			})

			it("should handle hyphenated technical terms", async () => {
				const mockFacts = [
					{
						id: "auto-scale-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Using Auto-Scaling and Load-Balancer configurations" },
					},
				]

				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				expect(result.tags).toEqual(expect.arrayContaining(["Auto-Scaling", "Load-Balancer"]))
			})
		})
	})

	describe("AutoHintsProvider", () => {
		let fileSystemProvider: FileSystemHintsProvider
		let memoryProvider: MemoryHintsProvider
		let mockVectorStore: IVectorStore

		beforeEach(() => {
			fileSystemProvider = new FileSystemHintsProvider("/test/workspace", ["extra1", "extra2"])

			mockVectorStore = {
				ensureCollection: vi.fn(),
				collectionName: vi.fn().mockReturnValue("test-collection"),
				upsert: vi.fn(),
				insert: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
				get: vi.fn(),
				search: vi.fn(),
				filter: vi.fn().mockResolvedValue([]),
				clearCollection: vi.fn(),
				deleteCollection: vi.fn(),
			}

			memoryProvider = new MemoryHintsProvider(mockVectorStore, "test-workspace")

			// Mock file system operations for consistent testing
			vi.mocked(fs.readFile).mockRejectedValue(new Error("File not found"))
			vi.mocked(fs.readdir).mockResolvedValue([])
		})

		describe("Constructor", () => {
			it("should initialize with filesystem provider only", () => {
				const provider = new AutoHintsProvider(fileSystemProvider)
				expect(provider).toBeInstanceOf(AutoHintsProvider)
			})

			it("should initialize with both filesystem and memory providers", () => {
				const provider = new AutoHintsProvider(fileSystemProvider, memoryProvider)
				expect(provider).toBeInstanceOf(AutoHintsProvider)
			})
		})

		describe("getHints with filesystem provider only", () => {
			it("should return only filesystem hints when no memory provider", async () => {
				const provider = new AutoHintsProvider(fileSystemProvider)

				// Mock filesystem results
				const mockPackageJson = { dependencies: { react: "^18.0.0" } }
				const mockDirEntries = [{ isDirectory: () => true, name: "src" }]

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})
				vi.mocked(fs.readdir).mockResolvedValue(mockDirEntries as any)

				const result = await provider.getHints()

				expect(result).toEqual({
					deps: ["react"],
					dirs: ["src"],
					extra: ["extra1", "extra2"],
				})
			})
		})

		describe("getHints with both providers", () => {
			it("should combine hints from both filesystem and memory providers", async () => {
				const provider = new AutoHintsProvider(fileSystemProvider, memoryProvider)

				// Mock filesystem results
				const mockPackageJson = { dependencies: { react: "^18.0.0" } }
				const mockDirEntries = [{ isDirectory: () => true, name: "src" }]

				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})
				vi.mocked(fs.readdir).mockResolvedValue(mockDirEntries as any)

				// Mock memory results
				const mockFacts = [
					{
						id: "ts-interface-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "Using TypeScript interfaces" },
					},
				]
				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				expect(result).toEqual({
					deps: ["react"],
					dirs: ["src"],
					extra: ["extra1", "extra2"],
					tags: expect.arrayContaining(["TypeScript"]),
				})
			})

			it("should handle memory provider failure gracefully", async () => {
				const provider = new AutoHintsProvider(fileSystemProvider, memoryProvider)

				// Mock filesystem results
				const mockPackageJson = { dependencies: { react: "^18.0.0" } }
				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})
				vi.mocked(fs.readdir).mockResolvedValue([])

				// Mock memory failure
				vi.mocked(mockVectorStore.filter)?.mockRejectedValue(new Error("Vector store failed"))

				const result = await provider.getHints()

				expect(result).toEqual({
					deps: ["react"],
					dirs: [],
					extra: ["extra1", "extra2"],
				})
			})

			it("should include tags only when memory provider returns results", async () => {
				const provider = new AutoHintsProvider(fileSystemProvider, memoryProvider)

				// Mock empty memory results
				vi.mocked(mockVectorStore.filter)?.mockResolvedValue([])

				const result = await provider.getHints()

				expect(result).toEqual({
					deps: [],
					dirs: [],
					extra: ["extra1", "extra2"],
				})
				expect(result.tags).toBeUndefined()
			})

			it("should pass project context to both providers", async () => {
				const provider = new AutoHintsProvider(fileSystemProvider, memoryProvider)
				const projectContext: ProjectContext = {
					workspaceName: "test-project",
					language: "typescript",
				}

				vi.mocked(mockVectorStore.filter)?.mockResolvedValue([])

				const result = await provider.getHints(projectContext)

				expect(result).toEqual({
					deps: [],
					dirs: [],
					extra: ["extra1", "extra2"],
				})
			})
		})

		describe("Provider priority and fallback logic", () => {
			it("should prioritize memory tags when available", async () => {
				const provider = new AutoHintsProvider(fileSystemProvider, memoryProvider)

				// Mock memory results with tags
				const mockFacts = [
					{
						id: "react-patterns-1",
						vector: [0.1, 0.2, 0.3],
						payload: { content: "React TypeScript patterns" },
					},
				]
				vi.mocked(mockVectorStore.filter)!.mockResolvedValue(mockFacts)

				const result = await provider.getHints()

				expect(result.tags).toEqual(["React", "TypeScript"])
			})

			it("should always include filesystem results regardless of memory status", async () => {
				const provider = new AutoHintsProvider(fileSystemProvider, memoryProvider)

				// Mock filesystem results
				const mockPackageJson = { dependencies: { lodash: "^4.0.0" } }
				vi.mocked(fs.readFile).mockImplementation((path: any) => {
					if (path.includes("package.json")) {
						return Promise.resolve(JSON.stringify(mockPackageJson))
					}
					return Promise.reject(new Error("File not found"))
				})

				// Mock memory failure
				vi.mocked(mockVectorStore.filter)?.mockRejectedValue(new Error("Memory error"))

				const result = await provider.getHints()

				expect(result.deps).toEqual(["lodash"])
				expect(result.extra).toEqual(["extra1", "extra2"])
			})
		})
	})

	describe("Integration scenarios", () => {
		it("should handle provider chain with realistic data", async () => {
			// Setup realistic test scenario
			const workspacePath = "/project/root"
			const workspaceId = "project-workspace-id"

			const mockVectorStore: IVectorStore = {
				ensureCollection: vi.fn(),
				collectionName: vi.fn().mockReturnValue("memory-collection"),
				upsert: vi.fn(),
				insert: vi.fn(),
				update: vi.fn(),
				delete: vi.fn(),
				get: vi.fn(),
				search: vi.fn(),
				filter: vi.fn(),
				clearCollection: vi.fn(),
				deleteCollection: vi.fn(),
			}

			const fsProvider = new FileSystemHintsProvider(workspacePath, ["custom-hint"])
			const memProvider = new MemoryHintsProvider(mockVectorStore, workspaceId)
			const autoProvider = new AutoHintsProvider(fsProvider, memProvider)

			// Mock realistic filesystem data
			const realPackageJson = {
				dependencies: {
					express: "^4.18.0",
					cors: "^2.8.5",
				},
				devDependencies: {
					typescript: "^4.9.0",
					vitest: "^0.25.0",
				},
			}
			const realDirs = [
				{ isDirectory: () => true, name: "src" },
				{ isDirectory: () => true, name: "tests" },
				{ isDirectory: () => true, name: "node_modules" }, // Should be filtered
			]

			vi.mocked(fs.readFile).mockImplementation((path: any) => {
				if (path.includes("package.json")) {
					return Promise.resolve(JSON.stringify(realPackageJson))
				}
				return Promise.reject(new Error("File not found"))
			})
			vi.mocked(fs.readdir).mockResolvedValue(realDirs as any)

			// Mock realistic memory data
			const realFacts = [
				{
					id: "express-1",
					vector: [0.1, 0.2, 0.3],
					payload: { content: "Express server with CORS middleware configuration" },
				},
				{
					id: "ts-api-1",
					vector: [0.4, 0.5, 0.6],
					payload: { content: "TypeScript interfaces for API responses" },
				},
			]
			vi.mocked(mockVectorStore.filter)!.mockResolvedValue(realFacts)

			const result = await autoProvider.getHints()

			expect(result).toEqual({
				deps: ["express", "cors", "typescript", "vitest"],
				dirs: ["src", "tests"],
				extra: ["custom-hint"],
				tags: expect.arrayContaining(["Express", "CORS", "TypeScript", "API"]),
			})
		})
	})
})
