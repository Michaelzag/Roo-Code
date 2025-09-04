export interface IEmbedder {
	readonly dimension: number
	embed(text: string): Promise<number[]>
	embedBatch(texts: string[]): Promise<number[][]>
}

export interface ILlmProvider {
	generateJson(prompt: string, options?: { temperature?: number; max_tokens?: number }): Promise<any>
	generateText?(prompt: string, options?: { temperature?: number; max_tokens?: number }): Promise<string>
}

export interface VectorRecord<TPayload = any> {
	id: string
	vector: number[]
	payload: TPayload
	score?: number
}

export interface IVectorStore {
	ensureCollection(name: string, dimension: number): Promise<void>
	collectionName(): string
	upsert(records: Array<VectorRecord<any>>): Promise<void>
	insert(vectors: number[][], ids: string[], payloads: any[]): Promise<void>
	update(id: string, vector: number[] | null, payload: any): Promise<void>
	delete(id: string): Promise<void>
	get(id: string): Promise<VectorRecord<any> | undefined>
	search(
		queryText: string,
		embedding: number[],
		limit: number,
		filters?: Record<string, any>,
	): Promise<Array<VectorRecord<any>>>
	filter?(
		limit: number,
		filters?: Record<string, any>,
		cursor?: any,
	): Promise<{ records: Array<VectorRecord<any>>; nextCursor?: any } | Array<VectorRecord<any>>>
	/** Optional: clears or deletes the backing collection for this workspace */
	clearCollection?(): Promise<void>
	deleteCollection?(): Promise<void>
}
