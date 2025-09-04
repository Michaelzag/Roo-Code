import React, { useState, useEffect, useCallback } from "react"
import { Trans } from "react-i18next"
import { VSCodeButton, VSCodeCheckbox } from "@vscode/webview-ui-toolkit/react"
import { AlertTriangle, Brain, Database } from "lucide-react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"
import {
	Popover,
	PopoverContent,
	Slider,
	AlertDialog,
	AlertDialogTrigger,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogAction,
	AlertDialogCancel,
} from "@src/components/ui"
import { useEscapeKey } from "@src/hooks/useEscapeKey"

interface MemoryPopoverProps {
	children: React.ReactNode
	memoryStatus: {
		initialized: boolean
		enabled: boolean
		codeIndexConfigured: boolean
	}
}

interface LocalMemorySettings {
	conversationMemoryEnabled: boolean
	promptBudgetTokens: number
	memoryToolDefaultLimit: number
	dailyProcessingBudgetUSD: number
}

export const MemoryPopover: React.FC<MemoryPopoverProps> = ({ children, memoryStatus }) => {
	const { t } = useAppTranslation() as any
	const extensionState = useExtensionState()
	const {
		conversationMemoryPromptBudgetTokens,
		conversationMemoryToolDefaultLimit,
		conversationMemoryDailyBudgetUSD,
		codebaseIndexConfig,
		experiments,
	} = extensionState
	const conversationMemoryEnabled = experiments?.conversationMemory || false

	const [isOpen, setIsOpen] = useState(false)
	const [localSettings, setLocalSettings] = useState<LocalMemorySettings>({
		conversationMemoryEnabled: conversationMemoryEnabled ?? false,
		promptBudgetTokens: conversationMemoryPromptBudgetTokens ?? 400,
		memoryToolDefaultLimit: conversationMemoryToolDefaultLimit ?? 10,
		dailyProcessingBudgetUSD: conversationMemoryDailyBudgetUSD ?? 1.0,
	})
	const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
	const [isSaving, setIsSaving] = useState(false)

	// Search state
	const [searchQuery, setSearchQuery] = useState("")
	const [isSearching, setIsSearching] = useState(false)
	const [searchError, setSearchError] = useState<string | null>(null)
	const [searchResults, setSearchResults] = useState<{ episodes?: any[]; facts?: any[] } | null>(null)

	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "memorySearchResults") {
				setIsSearching(false)
				if (message.values?.success) {
					setSearchError(null)
					setSearchResults({ episodes: message.values.episodes, facts: message.values.facts })
				} else {
					setSearchResults(null)
					setSearchError(message.values?.error || "Search failed")
				}
			}
		}
		window.addEventListener("message", handleMessage)
		return () => window.removeEventListener("message", handleMessage)
	}, [])

	// Update local settings when extension state changes
	useEffect(() => {
		setLocalSettings({
			conversationMemoryEnabled: conversationMemoryEnabled ?? false,
			promptBudgetTokens: conversationMemoryPromptBudgetTokens ?? 400,
			memoryToolDefaultLimit: conversationMemoryToolDefaultLimit ?? 10,
			dailyProcessingBudgetUSD: conversationMemoryDailyBudgetUSD ?? 1.0,
		})
	}, [
		conversationMemoryEnabled,
		conversationMemoryPromptBudgetTokens,
		conversationMemoryToolDefaultLimit,
		conversationMemoryDailyBudgetUSD,
	])

	// Check if Code Index is configured
	const isCodeIndexConfigured =
		codebaseIndexConfig?.codebaseIndexEnabled &&
		codebaseIndexConfig?.codebaseIndexQdrantUrl &&
		(codebaseIndexConfig?.codebaseIndexEmbedderProvider === "ollama"
			? codebaseIndexConfig?.codebaseIndexEmbedderBaseUrl
			: true)

	const handleSave = useCallback(async () => {
		setIsSaving(true)

		// Send save message
		// Save individual settings to match flat structure
		vscode.postMessage({
			type: "updateExperimental",
			values: { conversationMemory: localSettings.conversationMemoryEnabled },
		})
		vscode.postMessage({
			type: "conversationMemoryPromptBudgetTokens",
			value: localSettings.promptBudgetTokens,
		})
		vscode.postMessage({
			type: "conversationMemoryToolDefaultLimit",
			value: localSettings.memoryToolDefaultLimit,
		})
		vscode.postMessage({
			type: "conversationMemoryDailyBudgetUSD",
			value: localSettings.dailyProcessingBudgetUSD,
		})

		// Wait a bit for the save to process
		await new Promise((resolve) => setTimeout(resolve, 500))

		setIsSaving(false)
		setHasUnsavedChanges(false)
		setIsOpen(false)
	}, [localSettings])

	const handleCancel = useCallback(() => {
		// Reset to original values
		setLocalSettings({
			conversationMemoryEnabled: conversationMemoryEnabled ?? false,
			promptBudgetTokens: conversationMemoryPromptBudgetTokens ?? 400,
			memoryToolDefaultLimit: conversationMemoryToolDefaultLimit ?? 10,
			dailyProcessingBudgetUSD: conversationMemoryDailyBudgetUSD ?? 1.0,
		})
		setHasUnsavedChanges(false)
		setIsOpen(false)
	}, [
		conversationMemoryEnabled,
		conversationMemoryPromptBudgetTokens,
		conversationMemoryToolDefaultLimit,
		conversationMemoryDailyBudgetUSD,
	])

	const updateSetting = useCallback(<K extends keyof LocalMemorySettings>(key: K, value: LocalMemorySettings[K]) => {
		setLocalSettings((prev) => ({ ...prev, [key]: value }))
		setHasUnsavedChanges(true)
	}, [])

	const handleSearch = useCallback(() => {
		if (!searchQuery.trim()) return
		setIsSearching(true)
		setSearchError(null)
		setSearchResults(null)
		vscode.postMessage({ type: "memorySearch", query: searchQuery, limit: localSettings.memoryToolDefaultLimit })
	}, [searchQuery, localSettings.memoryToolDefaultLimit])

	useEscapeKey(isOpen, () => {
		if (!hasUnsavedChanges) {
			setIsOpen(false)
		}
	})

	return (
		<Popover open={isOpen} onOpenChange={setIsOpen}>
			{children}
			<PopoverContent
				className="w-[480px] p-6"
				align="end"
				sideOffset={8}
				onInteractOutside={(e) => {
					if (hasUnsavedChanges) {
						e.preventDefault()
					}
				}}>
				<div className="space-y-5">
					{/* Header */}
					<div className="flex items-center gap-3">
						<Brain className="w-5 h-5 text-vscode-foreground" />
						<h3 className="text-lg font-medium text-vscode-foreground">
							{t("chat:memorySettings.title", "Conversation Memory")}
						</h3>
					</div>

					{/* Code Index Warning */}
					{!isCodeIndexConfigured && (
						<div className="flex items-start gap-2 p-3 rounded bg-yellow-500/10 border border-yellow-500/30">
							<AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
							<div className="text-sm text-vscode-foreground">
								<p className="font-medium mb-1">
									{t("chat:memorySettings.codeIndexRequired", "Code Index Required")}
								</p>
								<p className="text-vscode-descriptionForeground">
									<Trans i18nKey="chat:memorySettings.codeIndexRequiredDesc">
										Conversation Memory requires Code Index to be configured. Please configure Code
										Index first using the
										<Database className="inline w-3 h-3 mx-1" />
										icon.
									</Trans>
								</p>
							</div>
						</div>
					)}

					{/* Enable Toggle */}
					<div className="space-y-2">
						<VSCodeCheckbox
							checked={localSettings.conversationMemoryEnabled}
							onChange={(e: any) => updateSetting("conversationMemoryEnabled", e.target.checked)}
							disabled={!isCodeIndexConfigured}>
							{t("chat:memorySettings.enable", "Enable Conversation Memory")}
						</VSCodeCheckbox>
						<p className="text-xs text-vscode-descriptionForeground ml-6">
							{t(
								"chat:memorySettings.enableDesc",
								"Automatically extract and store important facts from conversations",
							)}
						</p>
					</div>

					{/* Settings (only show when enabled) */}
					{localSettings.conversationMemoryEnabled && isCodeIndexConfigured && (
						<div className="space-y-4 pt-2 border-t border-vscode-widget-border">
							{/* Memory Search */}
							<div className="space-y-2">
								<label className="text-sm text-vscode-foreground">
									{t("chat:memorySettings.search", "Search Memories")}
								</label>
								<div className="flex gap-2">
									<input
										className="flex-1 bg-vscode-input-background text-vscode-input-foreground border border-vscode-input-border rounded px-2 py-1 text-sm"
										placeholder={t(
											"chat:memorySettings.searchPlaceholder",
											"e.g., authentication decisions",
										)}
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") handleSearch()
										}}
									/>
									<VSCodeButton onClick={handleSearch} disabled={isSearching}>
										{isSearching
											? t("common:searching", "Searching...")
											: t("common:search", "Search")}
									</VSCodeButton>
								</div>
								{searchError && <p className="text-xs text-red-500">{searchError}</p>}
								{searchResults && (
									<div className="max-h-48 overflow-auto border border-vscode-widget-border rounded p-2 space-y-2">
										{searchResults.episodes && searchResults.episodes.length > 0 && (
											<div>
												<p className="text-xs text-vscode-descriptionForeground mb-1">
													{t("chat:memorySettings.episodes", "Episodes")}
												</p>
												<ul className="space-y-1">
													{searchResults.episodes.map((ep: any, i: number) => (
														<li
															key={`ep-${i}`}
															className="text-xs text-vscode-foreground/90">
															<strong>{ep.episode_context}</strong> ({ep.fact_count})
															{Array.isArray(ep.facts) &&
																ep.facts.slice(0, 3).map((f: any, j: number) => (
																	<div key={`epf-${i}-${j}`}>
																		• {String(f.category).toUpperCase()}:{" "}
																		{f.content}
																	</div>
																))}
														</li>
													))}
												</ul>
											</div>
										)}
										{searchResults.facts && searchResults.facts.length > 0 && (
											<div>
												<p className="text-xs text-vscode-descriptionForeground mb-1">
													{t("chat:memorySettings.facts", "Facts")}
												</p>
												<ul className="space-y-1">
													{searchResults.facts.map((f: any, i: number) => (
														<li
															key={`f-${i}`}
															className="text-xs text-vscode-foreground/90">
															{String(f.category).toUpperCase()}: {f.content}
														</li>
													))}
												</ul>
											</div>
										)}
									</div>
								)}
							</div>
							{/* Prompt Budget */}
							<div className="space-y-2">
								<label className="text-sm text-vscode-foreground">
									{t("chat:memorySettings.promptBudget", "Prompt Budget (tokens)")}
									<span className="text-vscode-descriptionForeground ml-2">
										{localSettings.promptBudgetTokens}
									</span>
								</label>
								<Slider
									value={[localSettings.promptBudgetTokens]}
									onValueChange={([value]) => updateSetting("promptBudgetTokens", value)}
									min={100}
									max={2000}
									step={100}
									className="w-full"
								/>
								<p className="text-xs text-vscode-descriptionForeground">
									{t(
										"chat:memorySettings.promptBudgetDesc",
										"Maximum tokens to use for memory context in prompts",
									)}
								</p>
							</div>

							{/* Memory Tool Limit */}
							<div className="space-y-2">
								<label className="text-sm text-vscode-foreground">
									{t("chat:memorySettings.toolLimit", "Search Result Limit")}
									<span className="text-vscode-descriptionForeground ml-2">
										{localSettings.memoryToolDefaultLimit}
									</span>
								</label>
								<Slider
									value={[localSettings.memoryToolDefaultLimit]}
									onValueChange={([value]) => updateSetting("memoryToolDefaultLimit", value)}
									min={5}
									max={50}
									step={5}
									className="w-full"
								/>
								<p className="text-xs text-vscode-descriptionForeground">
									{t(
										"chat:memorySettings.toolLimitDesc",
										"Maximum number of memories to retrieve per search",
									)}
								</p>
							</div>

							{/* Daily Budget */}
							<div className="space-y-2">
								<label className="text-sm text-vscode-foreground">
									{t("chat:memorySettings.dailyBudget", "Daily Processing Budget")}
									<span className="text-vscode-descriptionForeground ml-2">
										${localSettings.dailyProcessingBudgetUSD.toFixed(2)}
									</span>
								</label>
								<Slider
									value={[localSettings.dailyProcessingBudgetUSD]}
									onValueChange={([value]) => updateSetting("dailyProcessingBudgetUSD", value)}
									min={0.1}
									max={10}
									step={0.1}
									className="w-full"
								/>
								<p className="text-xs text-vscode-descriptionForeground">
									{t(
										"chat:memorySettings.dailyBudgetDesc",
										"Maximum daily spend for memory extraction (USD)",
									)}
								</p>
							</div>
						</div>
					)}

					{/* Status */}
					{localSettings.conversationMemoryEnabled && isCodeIndexConfigured && (
						<div className="flex items-center gap-2 text-sm text-vscode-descriptionForeground">
							<div
								className={cn(
									"w-2 h-2 rounded-full",
									memoryStatus.initialized ? "bg-green-500" : "bg-yellow-500",
								)}
							/>
							<span>
								{memoryStatus.initialized
									? t("chat:memorySettings.statusReady", "Memory system ready")
									: t("chat:memorySettings.statusInitializing", "Initializing...")}
							</span>
						</div>
					)}

					{/* Clear Conversation Memory (danger zone) */}
					{localSettings.conversationMemoryEnabled && isCodeIndexConfigured && memoryStatus.initialized && (
						<div className="pt-4">
							<AlertDialog>
								<AlertDialogTrigger asChild>
									<VSCodeButton appearance="secondary">
										{t("chat:memorySettings.clearMemoryButton", "Clear Conversation Memory")}
									</VSCodeButton>
								</AlertDialogTrigger>
								<AlertDialogContent>
									<AlertDialogHeader>
										<AlertDialogTitle>
											{t(
												"chat:memorySettings.clearMemoryTitle",
												"Clear conversation memory for this workspace?",
											)}
										</AlertDialogTitle>
										<AlertDialogDescription>
											{t(
												"chat:memorySettings.clearMemoryDesc",
												'This will delete all stored memories and artifacts (".roo-memory") for the current workspace.',
											)}
										</AlertDialogDescription>
									</AlertDialogHeader>
									<AlertDialogFooter>
										<AlertDialogCancel>{t("common:cancel", "Cancel")}</AlertDialogCancel>
										<AlertDialogAction
											onClick={() => vscode.postMessage({ type: "clearConversationMemory" })}>
											{t("chat:memorySettings.clearMemoryConfirm", "Clear Memory")}
										</AlertDialogAction>
									</AlertDialogFooter>
								</AlertDialogContent>
							</AlertDialog>
						</div>
					)}

					{/* Actions */}
					<div className="flex justify-end gap-2 pt-2 border-t border-vscode-widget-border">
						<VSCodeButton appearance="secondary" onClick={handleCancel} disabled={isSaving}>
							{t("common:cancel", "Cancel")}
						</VSCodeButton>
						<VSCodeButton onClick={handleSave} disabled={!hasUnsavedChanges || isSaving}>
							{isSaving ? t("common:saving", "Saving...") : t("common:save", "Save")}
						</VSCodeButton>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	)
}
