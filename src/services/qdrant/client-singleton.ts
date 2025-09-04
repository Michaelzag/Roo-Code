import { QdrantClient } from "@qdrant/js-client-rest"
import { createQdrantClientFromUrl } from "./common"

/**
 * Singleton QdrantClient to prevent connection issues and improve performance
 */
class QdrantClientSingleton {
	private static instance?: QdrantClient
	private static currentUrl?: string
	private static currentApiKey?: string

	public static getInstance(url: string, apiKey?: string): QdrantClient {
		// Return existing client if URL and key match
		if (this.instance && this.currentUrl === url && this.currentApiKey === apiKey) {
			return this.instance
		}

		// Create new client if URL or key changed
		this.instance = createQdrantClientFromUrl(url, apiKey)
		this.currentUrl = url
		this.currentApiKey = apiKey

		return this.instance
	}

	public static reset(): void {
		this.instance = undefined
		this.currentUrl = undefined
		this.currentApiKey = undefined
	}
}

export { QdrantClientSingleton }
