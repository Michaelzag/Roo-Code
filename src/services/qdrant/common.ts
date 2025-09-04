import { QdrantClient, Schemas } from "@qdrant/js-client-rest"

/**
 * Parses and normalizes Qdrant server URLs to handle various input formats
 * - Supports host-based config with protocol/port detection
 * - Handles prefixes via `prefix` when using host-based constructor
 */
export function parseQdrantUrl(url: string | undefined): string {
	if (!url || url.trim() === "") return "http://localhost:6333"
	const trimmed = url.trim()
	if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.includes("://")) {
		return parseHostname(trimmed)
	}
	try {
		// Validate URL
		new URL(trimmed)
		return trimmed
	} catch {
		return parseHostname(trimmed)
	}
}

function parseHostname(hostname: string): string {
	if (hostname.includes(":")) {
		return hostname.startsWith("http") ? hostname : `http://${hostname}`
	}
	return `http://${hostname}`
}

/**
 * Creates a QdrantClient from a url string, normalizing for host/port/https/prefix.
 */
export function createQdrantClientFromUrl(url: string, apiKey?: string): QdrantClient {
	const parsed = parseQdrantUrl(url)
	try {
		const u = new URL(parsed)
		const port = u.port ? Number(u.port) : u.protocol === "https:" ? 443 : 80
		const https = u.protocol === "https:"
		const prefix = u.pathname === "/" ? undefined : u.pathname.replace(/\/+$/, "")
		return new QdrantClient({
			host: u.hostname,
			https,
			port,
			prefix,
			apiKey,
			headers: { "User-Agent": "Roo-Code" },
		})
	} catch {
		return new QdrantClient({ url: parsed, apiKey, headers: { "User-Agent": "Roo-Code" } })
	}
}

export type EnsureCollectionOptions = {
	distance?: Schemas["Distance"]
	onDisk?: boolean
	hnsw?: { m?: number; ef_construct?: number; on_disk?: boolean }
	payloadIndexes?: Array<{ field_name: string; field_schema: Schemas["PayloadSchemaType"] }>
}

/**
 * Ensures the collection exists with the desired vector dimension.
 * - Creates collection when missing
 * - Recreates collection if dimension mismatch
 * - Optionally creates payload indexes
 * Returns true if created/recreated, false if existed unchanged.
 */
export async function ensureCollection(
	client: QdrantClient,
	collectionName: string,
	vectorSize: number,
	opts: EnsureCollectionOptions = {},
): Promise<boolean> {
	const distance = opts.distance ?? "Cosine"
	const onDisk = opts.onDisk ?? true
	const hnsw = { m: 64, ef_construct: 512, on_disk: true, ...(opts.hnsw || {}) }

	let created = false

	// Try to get collection; if not, create
	let info: Schemas["CollectionInfo"] | null = null
	try {
		info = await client.getCollection(collectionName)
	} catch {
		info = null
	}

	if (!info) {
		await client.createCollection(collectionName, {
			vectors: { size: vectorSize, distance, on_disk: onDisk },
			hnsw_config: hnsw,
		})
		created = true
	} else {
		const vectorsConfig = info.config?.params?.vectors as any
		const existingSize = typeof vectorsConfig === "number" ? vectorsConfig : (vectorsConfig?.size ?? 0)
		if (existingSize !== vectorSize) {
			await client.deleteCollection(collectionName)
			// small delay to allow delete propagation
			await new Promise((r) => setTimeout(r, 100))
			await client.createCollection(collectionName, {
				vectors: { size: vectorSize, distance, on_disk: onDisk },
				hnsw_config: hnsw,
			})
			created = true
		}
	}

	// Create payload indexes if provided
	if (opts.payloadIndexes && opts.payloadIndexes.length) {
		for (const idx of opts.payloadIndexes) {
			try {
				await client.createPayloadIndex(collectionName, idx as any)
			} catch (e: any) {
				const msg = (e?.message || "").toLowerCase()
				if (!msg.includes("already exists")) {
					console.warn(
						`[QdrantCommon] Could not create payload index for ${idx.field_name} on ${collectionName}:`,
						e?.message || e,
					)
				}
			}
		}
	}

	return created
}
