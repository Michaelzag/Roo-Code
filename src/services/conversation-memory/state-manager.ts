import * as vscode from "vscode"

export type MemorySystemState = "Standby" | "Indexing" | "Indexed" | "Error"

export interface MemoryStatus {
	systemState: MemorySystemState
	systemMessage: string
	processedEpisodes: number
	totalEpisodes: number
}

export interface ProgressUpdate {
	state: MemorySystemState
	message: string
	progress: { processedEpisodes: number; totalEpisodes: number }
}

// Fallback EventEmitter for non-VSCode environments
class FallbackEventEmitter<T> {
	private _listeners: Array<(data: T) => void> = []

	get event() {
		return (listener: (data: T) => void) => {
			this._listeners.push(listener)
			return {
				dispose: () => {
					const index = this._listeners.indexOf(listener)
					if (index >= 0) {
						this._listeners.splice(index, 1)
					}
				},
			}
		}
	}

	fire(data: T): void {
		this._listeners.forEach((listener) => {
			try {
				listener(data)
			} catch (error) {
				console.warn("EventEmitter listener error:", error)
			}
		})
	}

	dispose(): void {
		this._listeners = []
	}
}

// Type-safe interface for EventEmitter-like objects
interface EventEmitterLike<T> {
	event: vscode.Event<T>
	fire(data: T): void
	dispose(): void
}

export class ConversationMemoryStateManager {
	private _systemState: MemorySystemState = "Standby"
	private _systemMessage = ""
	private _progressData = { processedEpisodes: 0, totalEpisodes: 0 }

	private _onProgressUpdate: EventEmitterLike<ProgressUpdate>
	public readonly onProgressUpdate: vscode.Event<ProgressUpdate>

	constructor() {
		// Robust environment detection with fallback
		const hasVSCodeEventEmitter = this.isVSCodeEnvironment()

		if (hasVSCodeEventEmitter) {
			this._onProgressUpdate = new vscode.EventEmitter<ProgressUpdate>()
		} else {
			this._onProgressUpdate = new FallbackEventEmitter<ProgressUpdate>()
		}

		this.onProgressUpdate = this._onProgressUpdate.event
	}

	/**
	 * Determines if we're in a VSCode environment with proper EventEmitter support
	 */
	private isVSCodeEnvironment(): boolean {
		try {
			// More robust check: try to actually instantiate EventEmitter
			if (typeof vscode !== "undefined" && vscode !== null && typeof vscode.EventEmitter === "function") {
				// Test if EventEmitter can actually be constructed
				const testEmitter = new vscode.EventEmitter<string>()
				testEmitter.dispose()
				return true
			}
			return false
		} catch {
			// If EventEmitter constructor fails or any other error, use fallback
			return false
		}
	}

	public get state(): MemorySystemState {
		return this._systemState
	}

	public setSystemState(state: MemorySystemState, message: string): void {
		this._systemState = state
		this._systemMessage = message
		this._onProgressUpdate?.fire({
			state: this._systemState,
			message: this._systemMessage,
			progress: this._progressData,
		})
	}

	public setProgress(processed: number, total: number): void {
		this._progressData = { processedEpisodes: processed, totalEpisodes: total }
		this._onProgressUpdate?.fire({
			state: this._systemState,
			message: this._systemMessage,
			progress: this._progressData,
		})
	}

	public getCurrentStatus(): MemoryStatus {
		return {
			systemState: this._systemState,
			systemMessage: this._systemMessage,
			processedEpisodes: this._progressData.processedEpisodes,
			totalEpisodes: this._progressData.totalEpisodes,
		}
	}

	// Configuration management for tests
	private _configuration: any = {}

	public setConfiguration(config: any): void {
		this._configuration = { ...this._configuration, ...config }
	}

	public getConfiguration(): any {
		return this._configuration
	}

	public dispose(): void {
		this._onProgressUpdate?.dispose()
	}
}
