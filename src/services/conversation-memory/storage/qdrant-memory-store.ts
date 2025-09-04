import { QdrantClient, Schemas } from "@qdrant/js-client-rest"
import { createHash } from "crypto"
import { IVectorStore, VectorRecord } from "../interfaces"
import { ensureCollection } from "../../qdrant/common"
import { QdrantClientSingleton } from "../../qdrant/client-singleton"

export class QdrantMemoryStore implements IVectorStore {
	private client: QdrantClient
	private _collectionName: string
	constructor(
		private readonly workspacePath: string,
		private readonly url: string,
		private readonly dimension: number,
		apiKey?: string,
	) {
		this.client = QdrantClientSingleton.getInstance(url, apiKey)
		const hash = createHash("sha256").update(workspacePath).digest("hex")
		this._collectionName = `ws-${hash.substring(0, 16)}-memory`

		console.log("[QdrantMemoryStore] Constructor - Created instance", {
			workspacePath: this.workspacePath,
			url: this.url,
			dimension: this.dimension,
			collectionName: this._collectionName,
			hasApiKey: !!apiKey,
		})
	}

	collectionName(): string {
		return this._collectionName
	}

	async ensureCollection(name: string, dimension: number): Promise<void> {
		console.log("[QdrantMemoryStore] ensureCollection called", {
			providedName: name,
			currentCollectionName: this._collectionName,
			dimension: dimension,
			expectedDimension: this.dimension,
		})

		// BUG FIX: Don't overwrite collection name - keep the workspace-specific name from constructor
		const originalName = this._collectionName

		try {
			await ensureCollection(this.client, this._collectionName, dimension, {
				distance: "Cosine",
				onDisk: true,
				hnsw: { m: 64, ef_construct: 512, on_disk: true },
			})
			console.log("[QdrantMemoryStore] ensureCollection completed successfully", {
				collectionName: this._collectionName,
				dimension: dimension,
			})
		} catch (error) {
			console.error("[QdrantMemoryStore] ensureCollection failed", {
				collectionName: this._collectionName,
				dimension: dimension,
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : undefined,
			})
			throw error
		}
	}

	/**
	 * CRITICAL FIX: Ensures collection exists before operations
	 * This prevents "Not Found" errors by validating collection existence
	 */
	private async ensureCollectionExists(): Promise<void> {
		try {
			// Test if collection exists by getting its info
			await this.client.getCollection(this._collectionName)
		} catch (error) {
			// Collection doesn't exist - create it
			console.warn("[QdrantMemoryStore] Collection does not exist, creating:", this._collectionName)
			await this.ensureCollection(this._collectionName, this.dimension)
		}
	}

	async upsert(records: Array<VectorRecord<any>>): Promise<void> {
		// CRITICAL FIX: Ensure collection exists before any operation
		await this.ensureCollectionExists()
		await this.client.upsert(this._collectionName, { points: records })
	}

	async insert(vectors: number[][], ids: string[], payloads: any[]): Promise<void> {
		// CRITICAL FIX: Ensure collection exists before any operation
		await this.ensureCollectionExists()

		console.log("[QdrantMemoryStore] insert called with", vectors.length, "vectors")

		// Filter out empty vectors
		const validPoints = ids
			.map((id, i) => ({ id, vector: vectors[i], payload: payloads[i] }))
			.filter((point) => {
				if (!point.vector || point.vector.length === 0) {
					console.warn("[QdrantMemoryStore] Skipping point with empty vector:", point.id)
					return false
				}
				return true
			})

		if (validPoints.length === 0) {
			console.warn("[QdrantMemoryStore] No valid points to insert (all vectors empty)")
			return
		}

		console.log("[QdrantMemoryStore] Inserting", validPoints.length, "valid points")
		await this.client.upsert(this._collectionName, { points: validPoints })
	}

	async update(id: string, vector: number[] | null, payload: any): Promise<void> {
		// CRITICAL FIX: Ensure collection exists before any operation
		await this.ensureCollectionExists()
		await this.client.setPayload(this._collectionName, { points: [id], payload })
		if (vector) {
			await this.client.updateVectors(this._collectionName, { points: [{ id, vector }] as any })
		}
	}

	async delete(id: string): Promise<void> {
		// CRITICAL FIX: Ensure collection exists before any operation
		await this.ensureCollectionExists()
		await this.client.delete(this._collectionName, { points: [id] })
	}

	async get(id: string): Promise<VectorRecord<any> | undefined> {
		// CRITICAL FIX: Ensure collection exists before any operation
		await this.ensureCollectionExists()
		const res = await this.client.retrieve(this._collectionName, {
			ids: [id],
			with_payload: true,
			with_vector: true,
		})
		const p = res?.[0] as any
		if (!p) return undefined
		return { id: p.id, vector: p.vector, payload: p.payload }
	}

	async search(
		queryText: string,
		embedding: number[],
		limit: number,
		filters?: Record<string, any>,
	): Promise<Array<VectorRecord<any>>> {
		// CRITICAL FIX: Ensure collection exists before any operation
		await this.ensureCollectionExists()

		const must: Schemas["Filter"]["must"] = []
		if (filters) {
			for (const [key, value] of Object.entries(filters)) {
				if (value === undefined) continue
				must.push({ key, match: { value } } as any)
			}
		}
		const filter = must.length ? { must } : undefined

		// Validate embedding dimensions
		if (!embedding || embedding.length === 0) {
			console.warn("[QdrantMemoryStore] Empty embedding provided, returning empty results")
			return []
		}

		if (embedding.length !== this.dimension) {
			console.error("[QdrantMemoryStore] Dimension mismatch:", {
				embeddingDim: embedding.length,
				expectedDim: this.dimension,
				collection: this._collectionName,
			})
			return []
		}

		try {
			const res = await this.client.query(this._collectionName, {
				query: embedding,
				limit,
				filter,
				with_payload: true,
				with_vector: false,
			})

			return res.points.map((p: any) => ({ id: p.id, vector: [], payload: p.payload, score: p.score }))
		} catch (error) {
			console.error("[QdrantMemoryStore] Query failed:", error)
			console.error("[QdrantMemoryStore] Collection:", this._collectionName)
			console.error("[QdrantMemoryStore] Filters:", JSON.stringify(filters))
			console.error("[QdrantMemoryStore] Query details:", {
				embeddingLength: embedding.length,
				expectedDimension: this.dimension,
				qdrantUrl: this.url,
			})
			// Return empty results instead of throwing to prevent crash
			return []
		}
	}

	async filter(
		limit: number,
		filters?: Record<string, any>,
		cursor?: any,
	): Promise<{ records: Array<VectorRecord<any>>; nextCursor?: any }> {
		// CRITICAL FIX: Ensure collection exists before any operation
		await this.ensureCollectionExists()

		const must: Schemas["Filter"]["must"] = []
		if (filters) {
			for (const [key, value] of Object.entries(filters)) {
				if (value === undefined) continue
				must.push({ key, match: { value } } as any)
			}
		}
		const filter = must.length ? { must } : undefined
		const args: any = { limit, filter, with_payload: true, with_vector: false }
		if (cursor) args.offset = cursor
		const res = await (this.client as any).scroll(this._collectionName, args)
		const points = (res?.points || []) as any[]
		const nextCursor = (res as any)?.next_page_offset
		return { records: points.map((p: any) => ({ id: p.id, vector: [], payload: p.payload })), nextCursor }
	}

	/**
	 * Clears all points from the collection (if supported by client)
	 */
	async clearCollection(): Promise<void> {
		try {
			await this.client.delete(this._collectionName, { filter: { must: [] }, wait: true } as any)
		} catch (error) {
			console.error("[QdrantMemoryStore] Failed to clear collection:", error)
			throw error
		}
	}

	/**
	 * Deletes the whole collection. Safe to call if it doesn't exist.
	 */
	async deleteCollection(): Promise<void> {
		try {
			await (this.client as any).deleteCollection?.(this._collectionName)
		} catch (error) {
			console.error(`[QdrantMemoryStore] Failed to delete collection ${this._collectionName}:`, error)
			throw error
		}
	}
}
