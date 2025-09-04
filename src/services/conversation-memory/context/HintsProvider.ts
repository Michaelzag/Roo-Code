import * as fs from "fs/promises"
import * as path from "path"
import type { HintsProvider } from "../interfaces/episode"
import type { ProjectContext } from "../types"
import type { IVectorStore } from "../interfaces"

// Workspace-based hints provider (no Roo dependency)
export class FileSystemHintsProvider implements HintsProvider {
	constructor(
		private readonly workspacePath: string,
		private readonly extra?: string[],
	) {}

	async getHints(project?: ProjectContext): Promise<{ deps?: string[]; dirs?: string[]; extra?: string[] }> {
		const deps = await this.readDependenciesFromManifests()
		const dirs = await this.listTopLevelDirs()

		return {
			deps,
			dirs,
			extra: this.extra,
		}
	}

	private async readDependenciesFromManifests(): Promise<string[]> {
		const deps: string[] = []

		try {
			// package.json dependencies
			const pkgPath = path.join(this.workspacePath, "package.json")
			const pkgContent = await fs.readFile(pkgPath, "utf-8").catch(() => null)
			if (pkgContent) {
				const pkg = JSON.parse(pkgContent)
				const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
				deps.push(...Object.keys(allDeps))
			}
		} catch {}

		try {
			// requirements.txt
			const reqPath = path.join(this.workspacePath, "requirements.txt")
			const reqContent = await fs.readFile(reqPath, "utf-8").catch(() => null)
			if (reqContent) {
				const pyDeps = reqContent
					.split("\n")
					.map((line) => line.split("==")[0].split(">=")[0].split("~=")[0].trim())
					.filter((dep) => dep && !dep.startsWith("#"))
				deps.push(...pyDeps)
			}
		} catch {}

		try {
			// Cargo.toml
			const cargoPath = path.join(this.workspacePath, "Cargo.toml")
			const cargoContent = await fs.readFile(cargoPath, "utf-8").catch(() => null)
			if (cargoContent) {
				const depMatches = cargoContent.match(/\[dependencies\]([\s\S]*?)(?=\[|$)/)
				if (depMatches) {
					const rustDeps = depMatches[1]
						.split("\n")
						.map((line) => line.split("=")[0].trim())
						.filter((dep) => dep && !dep.startsWith("#"))
					deps.push(...rustDeps)
				}
			}
		} catch {}

		return deps.slice(0, 20) // Limit to prevent prompt bloat
	}

	private async listTopLevelDirs(): Promise<string[]> {
		try {
			const entries = await fs.readdir(this.workspacePath, { withFileTypes: true })
			const dirs = entries
				.filter((entry) => entry.isDirectory())
				.map((entry) => entry.name)
				.filter(
					(name) =>
						!["node_modules", ".git", "dist", "build", "out", ".vscode", ".roo-memory"].includes(name),
				)

			return dirs.slice(0, 10) // Limit to prevent prompt bloat
		} catch {
			return []
		}
	}
}

// Memory-backed hints provider
export class MemoryHintsProvider implements HintsProvider {
	constructor(
		private readonly vectorStore: IVectorStore,
		private readonly workspaceId: string,
	) {}

	async getHints(_project?: ProjectContext): Promise<{ tags?: string[] }> {
		try {
			// Get frequent tags from existing facts
			const tags = await this.getFrequentTagsFromFacts()
			return { tags }
		} catch (error) {
			console.error("[MemoryHintsProvider] Failed to get hints:", error)
			return {}
		}
	}

	private async getFrequentTagsFromFacts(): Promise<string[]> {
		try {
			// Query for INFRASTRUCTURE and PATTERN facts to extract common terms
			const infraFacts = await this.vectorStore.filter?.(100, {
				workspace_path: this.workspaceId,
				category: "infrastructure",
			})
			const patternFacts = await this.vectorStore.filter?.(100, {
				workspace_path: this.workspaceId,
				category: "pattern",
			})

			const allFacts = [
				...(Array.isArray(infraFacts) ? infraFacts : infraFacts?.records || []),
				...(Array.isArray(patternFacts) ? patternFacts : patternFacts?.records || []),
			]

			const tags = new Set<string>()

			// Extract technical terms from fact content
			for (const factRecord of allFacts) {
				const content = factRecord.payload?.content || ""
				const techTerms = content.match(/\b[A-Z][A-Za-z0-9_-]+\b/g) || []
				techTerms.forEach((term: string) => {
					if (term.length > 2 && term.length < 20) {
						tags.add(term)
					}
				})
			}

			return Array.from(tags).slice(0, 15) // Limit for prompt efficiency
		} catch {
			return []
		}
	}
}

// Composite hints provider with auto source selection
export class AutoHintsProvider implements HintsProvider {
	constructor(
		private readonly fileSystemProvider: FileSystemHintsProvider,
		private readonly memoryProvider?: MemoryHintsProvider,
	) {}

	async getHints(
		project?: ProjectContext,
	): Promise<{ deps?: string[]; tags?: string[]; dirs?: string[]; extra?: string[] }> {
		const results: { deps?: string[]; tags?: string[]; dirs?: string[]; extra?: string[] } = {}

		// Try memory first, then workspace
		if (this.memoryProvider) {
			const memoryHints = await this.memoryProvider.getHints(project)
			if (memoryHints.tags?.length) {
				results.tags = memoryHints.tags
			}
		}

		// Always get workspace hints
		const workspaceHints = await this.fileSystemProvider.getHints(project)
		results.deps = workspaceHints.deps
		results.dirs = workspaceHints.dirs
		results.extra = workspaceHints.extra

		return results
	}
}
