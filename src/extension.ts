import * as vscode from "vscode"
import * as dotenvx from "@dotenvx/dotenvx"
import * as path from "path"

// Load environment variables from .env file
try {
	// Specify path to .env file in the project root directory
	const envPath = path.join(__dirname, "..", ".env")
	dotenvx.config({ path: envPath })
} catch (e) {
	// Silently handle environment loading errors
	console.warn("Failed to load environment variables:", e)
}

import type { CloudUserInfo } from "@roo-code/types"
import { CloudService, BridgeOrchestrator } from "@roo-code/cloud"
import { TelemetryService, PostHogTelemetryClient } from "@roo-code/telemetry"

import "./utils/path" // Necessary to have access to String.prototype.toPosix.
import { createOutputChannelLogger, createDualLogger } from "./utils/outputChannelLogger"

import { Package } from "./shared/package"
import { formatLanguage } from "./shared/language"
import { ContextProxy } from "./core/config/ContextProxy"
import { ClineProvider } from "./core/webview/ClineProvider"
import { DIFF_VIEW_URI_SCHEME } from "./integrations/editor/DiffViewProvider"
import { TerminalRegistry } from "./integrations/terminal/TerminalRegistry"
import { McpServerManager } from "./services/mcp/McpServerManager"
import { CodeIndexManager } from "./services/code-index/manager"
import { MdmService } from "./services/mdm/MdmService"
import { migrateSettings } from "./utils/migrateSettings"
import { autoImportSettings } from "./utils/autoImportSettings"
import { API } from "./extension/api"

import {
	handleUri,
	registerCommands,
	registerCodeActions,
	registerTerminalActions,
	CodeActionProvider,
} from "./activate"
import { initializeI18n } from "./i18n"

/**
 * Built using https://github.com/microsoft/vscode-webview-ui-toolkit
 *
 * Inspired by:
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/default/weather-webview
 *  - https://github.com/microsoft/vscode-webview-ui-toolkit-samples/tree/main/frameworks/hello-world-react-cra
 */

let outputChannel: vscode.OutputChannel
let extensionContext: vscode.ExtensionContext
let cloudService: CloudService | undefined

let authStateChangedHandler: (() => void) | undefined
let settingsUpdatedHandler: (() => void) | undefined
let userInfoHandler: ((data: { userInfo: CloudUserInfo }) => Promise<void>) | undefined

// This method is called when your extension is activated.
// Your extension is activated the very first time the command is executed.
export async function activate(context: vscode.ExtensionContext) {
	// Add uncaught exception handler to catch and log crashes
	process.on("uncaughtException", (error) => {
		console.error("[UNCAUGHT EXCEPTION] Fatal error occurred:", error)
		console.error("[UNCAUGHT EXCEPTION] Stack trace:", error.stack)
		if (outputChannel) {
			outputChannel.appendLine(`[UNCAUGHT EXCEPTION] Fatal error: ${error.message}`)
			outputChannel.appendLine(`[UNCAUGHT EXCEPTION] Stack: ${error.stack}`)
		}
		// Log to VS Code's standard error reporting
		vscode.window.showErrorMessage(`Roo-Code Extension Error: ${error.message}`)
	})

	process.on("unhandledRejection", (reason, promise) => {
		console.error("[UNHANDLED REJECTION] Unhandled promise rejection:", reason)
		console.error("[UNHANDLED REJECTION] Promise:", promise)
		if (outputChannel) {
			outputChannel.appendLine(`[UNHANDLED REJECTION] ${reason}`)
		}
	})

	extensionContext = context
	outputChannel = vscode.window.createOutputChannel(Package.outputChannel)
	context.subscriptions.push(outputChannel)
	outputChannel.appendLine(`${Package.name} extension activated - ${JSON.stringify(Package)}`)

	// Migrate old settings to new
	await migrateSettings(context, outputChannel)

	// Initialize telemetry service.
	const telemetryService = TelemetryService.createInstance()

	try {
		telemetryService.register(new PostHogTelemetryClient())
	} catch (error) {
		console.warn("Failed to register PostHogTelemetryClient:", error)
	}

	// Create logger for cloud services.
	const cloudLogger = createDualLogger(createOutputChannelLogger(outputChannel))

	// Initialize MDM service
	const mdmService = await MdmService.createInstance(cloudLogger)

	// Initialize i18n for internationalization support.
	initializeI18n(context.globalState.get("language") ?? formatLanguage(vscode.env.language))

	// Initialize terminal shell execution handlers.
	TerminalRegistry.initialize()

	// Get default commands from configuration.
	const defaultCommands = vscode.workspace.getConfiguration(Package.name).get<string[]>("allowedCommands") || []

	// Initialize global state if not already set.
	if (!context.globalState.get("allowedCommands")) {
		context.globalState.update("allowedCommands", defaultCommands)
	}

	outputChannel.appendLine("[Extension] Creating ContextProxy...")
	console.log("[Extension] Creating ContextProxy...")
	const contextProxy = await ContextProxy.getInstance(context)
	outputChannel.appendLine("[Extension] ContextProxy created successfully")
	console.log("[Extension] ContextProxy created successfully")

	// Initialize code index managers for all workspace folders.
	outputChannel.appendLine("[Extension] Starting Code Index manager initialization...")
	console.log("[Extension] Starting Code Index manager initialization...")
	const codeIndexManagers: CodeIndexManager[] = []

	if (vscode.workspace.workspaceFolders) {
		outputChannel.appendLine(
			`[Extension] Found ${vscode.workspace.workspaceFolders.length} workspace folders for Code Index`,
		)
		for (const folder of vscode.workspace.workspaceFolders) {
			outputChannel.appendLine(`[CodeIndexManager] Getting instance for: ${folder.uri.fsPath}`)
			const manager = CodeIndexManager.getInstance(context, folder.uri.fsPath)

			if (manager) {
				codeIndexManagers.push(manager)

				try {
					outputChannel.appendLine(`[CodeIndexManager] Initializing for: ${folder.uri.fsPath}`)
					await manager.initialize(contextProxy)
					outputChannel.appendLine(`[CodeIndexManager] Successfully initialized for: ${folder.uri.fsPath}`)
				} catch (error: any) {
					outputChannel.appendLine(
						`[CodeIndexManager] Error during background CodeIndexManager configuration/indexing for ${folder.uri.fsPath}: ${error?.message || error}`,
					)
					outputChannel.appendLine(`[CodeIndexManager] Stack trace: ${error?.stack || "No stack trace"}`)
				}

				context.subscriptions.push(manager)
			} else {
				outputChannel.appendLine(`[CodeIndexManager] No manager created for: ${folder.uri.fsPath}`)
			}
		}
	} else {
		outputChannel.appendLine("[Extension] No workspace folders found for Code Index")
	}
	outputChannel.appendLine("[Extension] Code Index manager initialization complete")

	// Initialize conversation memory managers AFTER code index is complete
	// This ensures proper dependency order
	const memoryManagers: any[] = []
	try {
		outputChannel.appendLine("[ConversationMemory] Starting memory manager initialization (after Code Index)...")
		console.log("[ConversationMemory] Importing manager module...")

		const { ConversationMemoryManager } = await import("./services/conversation-memory/manager")

		console.log("[ConversationMemory] Module imported successfully")
		outputChannel.appendLine("[ConversationMemory] Module imported successfully")

		if (vscode.workspace.workspaceFolders) {
			outputChannel.appendLine(
				`[ConversationMemory] Found ${vscode.workspace.workspaceFolders.length} workspace folders`,
			)

			for (const folder of vscode.workspace.workspaceFolders) {
				try {
					outputChannel.appendLine(`[ConversationMemory] Getting instance for: ${folder.uri.fsPath}`)
					console.log("[ConversationMemory] Getting instance for:", folder.uri.fsPath)

					const manager = ConversationMemoryManager.getInstance(context, folder.uri.fsPath)

					if (manager) {
						outputChannel.appendLine(
							`[ConversationMemory] Manager instance created for: ${folder.uri.fsPath}`,
						)
						console.log("[ConversationMemory] Manager instance created")

						memoryManagers.push(manager)

						try {
							outputChannel.appendLine(
								`[ConversationMemory] Initializing manager for: ${folder.uri.fsPath}`,
							)
							console.log("[ConversationMemory] Calling initialize on manager...")

							await manager.initialize(contextProxy)

							outputChannel.appendLine(
								`[ConversationMemory] Successfully initialized for ${folder.uri.fsPath}`,
							)
							console.log("[ConversationMemory] Manager initialized successfully")
						} catch (error: any) {
							outputChannel.appendLine(
								`[ConversationMemory] Error during initialization for ${folder.uri.fsPath}: ${error?.message || String(error)}`,
							)
							outputChannel.appendLine(
								`[ConversationMemory] Stack trace: ${error?.stack || "No stack trace"}`,
							)
							console.error("[ConversationMemory] Initialization error:", error)
							console.error("[ConversationMemory] Stack:", error?.stack)
						}

						context.subscriptions.push(manager)
					} else {
						outputChannel.appendLine(`[ConversationMemory] No manager created for: ${folder.uri.fsPath}`)
						console.log("[ConversationMemory] Manager was undefined")
					}
				} catch (instanceError: any) {
					outputChannel.appendLine(
						`[ConversationMemory] Failed to get instance for ${folder.uri.fsPath}: ${instanceError?.message || String(instanceError)}`,
					)
					outputChannel.appendLine(
						`[ConversationMemory] Instance error stack: ${instanceError?.stack || "No stack trace"}`,
					)
					console.error("[ConversationMemory] Failed to get instance:", instanceError)
					console.error("[ConversationMemory] Instance error stack:", instanceError?.stack)
				}
			}
		} else {
			outputChannel.appendLine("[ConversationMemory] No workspace folders found")
			console.log("[ConversationMemory] No workspace folders")
		}
	} catch (e: any) {
		outputChannel.appendLine(`[ConversationMemory] Failed to load module: ${e?.message || String(e)}`)
		outputChannel.appendLine(`[ConversationMemory] Module load error stack: ${e?.stack || "No stack trace"}`)
		outputChannel.appendLine(
			"[ConversationMemory] Conversation Memory will be disabled. The extension will continue to work normally.",
		)
		outputChannel.appendLine(
			"[ConversationMemory] To use Memory features, ensure Code Index is enabled and properly configured first.",
		)
		console.error("[ConversationMemory] Failed to load module:", e)
		console.error("[ConversationMemory] Module error stack:", e?.stack)
	}

	// Initialize the provider *before* the Roo Code Cloud service.
	const provider = new ClineProvider(context, outputChannel, "sidebar", contextProxy, mdmService)

	// Initialize Roo Code Cloud service.
	const postStateListener = () => ClineProvider.getVisibleInstance()?.postStateToWebview()
	authStateChangedHandler = postStateListener

	settingsUpdatedHandler = async () => {
		const userInfo = CloudService.instance.getUserInfo()
		if (userInfo && CloudService.instance.cloudAPI) {
			try {
				const config = await CloudService.instance.cloudAPI.bridgeConfig()

				const isCloudAgent =
					typeof process.env.ROO_CODE_CLOUD_TOKEN === "string" && process.env.ROO_CODE_CLOUD_TOKEN.length > 0

				const remoteControlEnabled = isCloudAgent
					? true
					: (CloudService.instance.getUserSettings()?.settings?.extensionBridgeEnabled ?? false)

				cloudLogger(`[CloudService] Settings updated - remoteControlEnabled = ${remoteControlEnabled}`)

				await BridgeOrchestrator.connectOrDisconnect(userInfo, remoteControlEnabled, {
					...config,
					provider,
					sessionId: vscode.env.sessionId,
				})
			} catch (error) {
				cloudLogger(
					`[CloudService] Failed to update BridgeOrchestrator on settings change: ${error instanceof Error ? error.message : String(error)}`,
				)
			}
		}

		postStateListener()
	}

	userInfoHandler = async ({ userInfo }: { userInfo: CloudUserInfo }) => {
		postStateListener()

		if (!CloudService.instance.cloudAPI) {
			cloudLogger("[CloudService] CloudAPI is not initialized")
			return
		}

		try {
			const config = await CloudService.instance.cloudAPI.bridgeConfig()

			const isCloudAgent =
				typeof process.env.ROO_CODE_CLOUD_TOKEN === "string" && process.env.ROO_CODE_CLOUD_TOKEN.length > 0

			cloudLogger(`[CloudService] isCloudAgent = ${isCloudAgent}, socketBridgeUrl = ${config.socketBridgeUrl}`)

			const remoteControlEnabled = isCloudAgent
				? true
				: (CloudService.instance.getUserSettings()?.settings?.extensionBridgeEnabled ?? false)

			await BridgeOrchestrator.connectOrDisconnect(userInfo, remoteControlEnabled, {
				...config,
				provider,
				sessionId: vscode.env.sessionId,
			})
		} catch (error) {
			cloudLogger(
				`[CloudService] Failed to fetch bridgeConfig: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	cloudService = await CloudService.createInstance(context, cloudLogger, {
		"auth-state-changed": authStateChangedHandler,
		"settings-updated": settingsUpdatedHandler,
		"user-info": userInfoHandler,
	})

	try {
		if (cloudService.telemetryClient) {
			TelemetryService.instance.register(cloudService.telemetryClient)
		}
	} catch (error) {
		outputChannel.appendLine(
			`[CloudService] Failed to register TelemetryClient: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	// Add to subscriptions for proper cleanup on deactivate.
	context.subscriptions.push(cloudService)

	// Finish initializing the provider.
	TelemetryService.instance.setProvider(provider)

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ClineProvider.sideBarId, provider, {
			webviewOptions: { retainContextWhenHidden: true },
		}),
	)

	// Auto-import configuration if specified in settings.
	try {
		await autoImportSettings(outputChannel, {
			providerSettingsManager: provider.providerSettingsManager,
			contextProxy: provider.contextProxy,
			customModesManager: provider.customModesManager,
		})
	} catch (error) {
		outputChannel.appendLine(
			`[AutoImport] Error during auto-import: ${error instanceof Error ? error.message : String(error)}`,
		)
	}

	registerCommands({ context, outputChannel, provider })

	/**
	 * We use the text document content provider API to show the left side for diff
	 * view by creating a virtual document for the original content. This makes it
	 * readonly so users know to edit the right side if they want to keep their changes.
	 *
	 * This API allows you to create readonly documents in VSCode from arbitrary
	 * sources, and works by claiming an uri-scheme for which your provider then
	 * returns text contents. The scheme must be provided when registering a
	 * provider and cannot change afterwards.
	 *
	 * Note how the provider doesn't create uris for virtual documents - its role
	 * is to provide contents given such an uri. In return, content providers are
	 * wired into the open document logic so that providers are always considered.
	 *
	 * https://code.visualstudio.com/api/extension-guides/virtual-documents
	 */
	const diffContentProvider = new (class implements vscode.TextDocumentContentProvider {
		provideTextDocumentContent(uri: vscode.Uri): string {
			return Buffer.from(uri.query, "base64").toString("utf-8")
		}
	})()

	context.subscriptions.push(
		vscode.workspace.registerTextDocumentContentProvider(DIFF_VIEW_URI_SCHEME, diffContentProvider),
	)

	context.subscriptions.push(vscode.window.registerUriHandler({ handleUri }))

	// Register code actions provider.
	context.subscriptions.push(
		vscode.languages.registerCodeActionsProvider({ pattern: "**/*" }, new CodeActionProvider(), {
			providedCodeActionKinds: CodeActionProvider.providedCodeActionKinds,
		}),
	)

	registerCodeActions(context)
	registerTerminalActions(context)

	// Allows other extensions to activate once Roo is ready.
	vscode.commands.executeCommand(`${Package.name}.activationCompleted`)

	// Implements the `RooCodeAPI` interface.
	const socketPath = process.env.ROO_CODE_IPC_SOCKET_PATH
	const enableLogging = typeof socketPath === "string"

	// Watch the core files and automatically reload the extension host.
	if (process.env.NODE_ENV === "development") {
		const watchPaths = [
			{ path: context.extensionPath, pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "../packages/types"), pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "../packages/telemetry"), pattern: "**/*.ts" },
			{ path: path.join(context.extensionPath, "node_modules/@roo-code/cloud"), pattern: "**/*" },
		]

		console.log(
			`♻️♻️♻️ Core auto-reloading: Watching for changes in ${watchPaths.map(({ path }) => path).join(", ")}`,
		)

		// Create a debounced reload function to prevent excessive reloads
		let reloadTimeout: NodeJS.Timeout | undefined
		const DEBOUNCE_DELAY = 1_000

		const debouncedReload = (uri: vscode.Uri) => {
			if (reloadTimeout) {
				clearTimeout(reloadTimeout)
			}

			console.log(`♻️ ${uri.fsPath} changed; scheduling reload...`)

			reloadTimeout = setTimeout(() => {
				console.log(`♻️ Reloading host after debounce delay...`)
				vscode.commands.executeCommand("workbench.action.reloadWindow")
			}, DEBOUNCE_DELAY)
		}

		watchPaths.forEach(({ path: watchPath, pattern }) => {
			const relPattern = new vscode.RelativePattern(vscode.Uri.file(watchPath), pattern)
			const watcher = vscode.workspace.createFileSystemWatcher(relPattern, false, false, false)

			// Listen to all change types to ensure symlinked file updates trigger reloads.
			watcher.onDidChange(debouncedReload)
			watcher.onDidCreate(debouncedReload)
			watcher.onDidDelete(debouncedReload)

			context.subscriptions.push(watcher)
		})

		// Clean up the timeout on deactivation
		context.subscriptions.push({
			dispose: () => {
				if (reloadTimeout) {
					clearTimeout(reloadTimeout)
				}
			},
		})
	}

	return new API(outputChannel, provider, socketPath, enableLogging)
}

// This method is called when your extension is deactivated.
export async function deactivate() {
	outputChannel.appendLine(`${Package.name} extension deactivated`)

	if (cloudService && CloudService.hasInstance()) {
		try {
			if (authStateChangedHandler) {
				CloudService.instance.off("auth-state-changed", authStateChangedHandler)
			}

			if (settingsUpdatedHandler) {
				CloudService.instance.off("settings-updated", settingsUpdatedHandler)
			}

			if (userInfoHandler) {
				CloudService.instance.off("user-info", userInfoHandler as any)
			}

			outputChannel.appendLine("CloudService event handlers cleaned up")
		} catch (error) {
			outputChannel.appendLine(
				`Failed to clean up CloudService event handlers: ${error instanceof Error ? error.message : String(error)}`,
			)
		}
	}

	const bridge = BridgeOrchestrator.getInstance()

	if (bridge) {
		await bridge.disconnect()
	}

	await McpServerManager.cleanup(extensionContext)
	TelemetryService.instance.shutdown()
	TerminalRegistry.cleanup()

	// Best-effort: finalize conversation memory session (flush any pending state)
	try {
		const { ConversationMemoryManager } = await import("./services/conversation-memory/manager")
		if (vscode.workspace.workspaceFolders) {
			for (const folder of vscode.workspace.workspaceFolders) {
				const mgr = ConversationMemoryManager.getInstance(extensionContext, folder.uri.fsPath)
				if (mgr && mgr.isFeatureEnabled) {
					await mgr.finalizeSession().catch(() => {})
				}
			}
		}
	} catch {
		// ignore
	}
}
