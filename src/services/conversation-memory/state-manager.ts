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

export class ConversationMemoryStateManager {
	private _systemState: MemorySystemState = "Standby"
	private _systemMessage = ""
	private _progressData = { processedEpisodes: 0, totalEpisodes: 0 }

	// Use VSCode EventEmitter if available, otherwise no-op for tests
	private _onProgressUpdate?: vscode.EventEmitter<ProgressUpdate>
	public readonly onProgressUpdate?: vscode.Event<ProgressUpdate>

	constructor() {
		// Only create EventEmitter if vscode is available
		if (typeof vscode !== "undefined" && vscode.EventEmitter) {
			this._onProgressUpdate = new vscode.EventEmitter<ProgressUpdate>()
			this.onProgressUpdate = this._onProgressUpdate.event
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

	public dispose(): void {
		this._onProgressUpdate?.dispose()
	}
}
