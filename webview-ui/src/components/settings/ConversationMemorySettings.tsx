import React, { useState, useEffect } from "react"
import { VSCodeCheckbox, VSCodeTextField, VSCodeDivider } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@/i18n/TranslationContext"
import { ChevronDown, ChevronRight, Brain } from "lucide-react"

interface ConversationMemorySettingsProps {
	enabled: boolean
	onChange: (enabled: boolean) => void
	promptBudgetTokens?: number
	memoryToolDefaultLimit?: number
	dailyProcessingBudgetUSD?: number
	setPromptBudgetTokens?: (tokens: number) => void
	setMemoryToolDefaultLimit?: (limit: number) => void
	setDailyProcessingBudgetUSD?: (budget: number) => void
	codebaseIndexConfig?: any
}

export const ConversationMemorySettings = ({
	enabled,
	onChange,
	promptBudgetTokens = 400,
	memoryToolDefaultLimit = 10,
	dailyProcessingBudgetUSD = 1.0,
	setPromptBudgetTokens,
	setMemoryToolDefaultLimit,
	setDailyProcessingBudgetUSD,
	codebaseIndexConfig,
}: ConversationMemorySettingsProps) => {
	const { t } = useAppTranslation()

	const [showAdvanced, setShowAdvanced] = useState(false)
	const [localPromptBudget, setLocalPromptBudget] = useState(promptBudgetTokens.toString())
	const [localToolLimit, setLocalToolLimit] = useState(memoryToolDefaultLimit.toString())
	const [localDailyBudget, setLocalDailyBudget] = useState(dailyProcessingBudgetUSD.toString())

	// Update local state when props change
	useEffect(() => {
		setLocalPromptBudget(promptBudgetTokens.toString())
		setLocalToolLimit(memoryToolDefaultLimit.toString())
		setLocalDailyBudget(dailyProcessingBudgetUSD.toString())
	}, [promptBudgetTokens, memoryToolDefaultLimit, dailyProcessingBudgetUSD])

	// Handle numeric input changes with validation
	const handlePromptBudgetChange = (value: string) => {
		setLocalPromptBudget(value)
		const numValue = parseInt(value)
		if (!isNaN(numValue) && numValue > 0 && numValue <= 2000 && setPromptBudgetTokens) {
			setPromptBudgetTokens(numValue)
		}
	}

	const handleToolLimitChange = (value: string) => {
		setLocalToolLimit(value)
		const numValue = parseInt(value)
		if (!isNaN(numValue) && numValue > 0 && numValue <= 50 && setMemoryToolDefaultLimit) {
			setMemoryToolDefaultLimit(numValue)
		}
	}

	const handleDailyBudgetChange = (value: string) => {
		setLocalDailyBudget(value)
		const numValue = parseFloat(value)
		if (!isNaN(numValue) && numValue >= 0 && numValue <= 100 && setDailyProcessingBudgetUSD) {
			setDailyProcessingBudgetUSD(numValue)
		}
	}

	return (
		<div className="space-y-4">
			<div>
				<div className="flex items-center gap-2">
					<VSCodeCheckbox checked={enabled} onChange={(e: any) => onChange(e.target.checked)}>
						<span className="font-medium flex items-center gap-2">
							<Brain className="w-4 h-4" />
							{t("settings:experimental.CONVERSATION_MEMORY.name")}
						</span>
					</VSCodeCheckbox>
				</div>
				<p className="text-vscode-descriptionForeground text-sm mt-1 ml-6">
					{t("settings:experimental.CONVERSATION_MEMORY.description")}
				</p>
			</div>

			{enabled && (
				<div className="ml-6 space-y-4">
					{/* Core Settings */}
					<div className="space-y-3">
						{/* Prompt Budget Tokens */}
						<div>
							<label className="block font-medium mb-1">
								{t("settings:experimental.CONVERSATION_MEMORY.promptBudgetLabel")}
							</label>
							<VSCodeTextField
								value={localPromptBudget}
								onInput={(e: any) => handlePromptBudgetChange(e.target.value)}
								placeholder="400"
								className="w-32"
							/>
							<p className="text-vscode-descriptionForeground text-xs mt-1">
								{t("settings:experimental.CONVERSATION_MEMORY.promptBudgetDescription")}
							</p>
						</div>

						{/* Memory Tool Default Limit */}
						<div>
							<label className="block font-medium mb-1">
								{t("settings:experimental.CONVERSATION_MEMORY.toolLimitLabel")}
							</label>
							<VSCodeTextField
								value={localToolLimit}
								onInput={(e: any) => handleToolLimitChange(e.target.value)}
								placeholder="10"
								className="w-32"
							/>
							<p className="text-vscode-descriptionForeground text-xs mt-1">
								{t("settings:experimental.CONVERSATION_MEMORY.toolLimitDescription")}
							</p>
						</div>

						{/* Daily Processing Budget */}
						<div>
							<label className="block font-medium mb-1">
								{t("settings:experimental.CONVERSATION_MEMORY.dailyBudgetLabel")}
							</label>
							<div className="flex items-center gap-1">
								<span className="text-vscode-foreground">$</span>
								<VSCodeTextField
									value={localDailyBudget}
									onInput={(e: any) => handleDailyBudgetChange(e.target.value)}
									placeholder="1.00"
									className="w-32"
								/>
							</div>
							<p className="text-vscode-descriptionForeground text-xs mt-1">
								{t("settings:experimental.CONVERSATION_MEMORY.dailyBudgetDescription")}
							</p>
						</div>
					</div>

					{/* Advanced Settings Toggle */}
					<div>
						<VSCodeDivider />
						<button
							onClick={() => setShowAdvanced(!showAdvanced)}
							className="flex items-center gap-2 text-vscode-foreground hover:text-vscode-focusBorder py-2">
							{showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
							<span className="text-sm font-medium">
								{t("settings:experimental.CONVERSATION_MEMORY.advancedSettings")}
							</span>
						</button>
					</div>

					{/* Advanced Settings Content */}
					{showAdvanced && (
						<div className="ml-6 space-y-3 p-3 bg-vscode-editor-background rounded">
							<p className="text-vscode-descriptionForeground text-xs">
								{t("settings:experimental.CONVERSATION_MEMORY.advancedSettingsNote")}
							</p>
							<div className="text-xs text-vscode-descriptionForeground">
								<p className="font-medium mb-1">
									{t("settings:experimental.CONVERSATION_MEMORY.advancedFeaturesTitle")}
								</p>
								<ul className="list-disc list-inside space-y-1 ml-2">
									<li>{t("settings:experimental.CONVERSATION_MEMORY.advancedFeature1")}</li>
									<li>{t("settings:experimental.CONVERSATION_MEMORY.advancedFeature2")}</li>
									<li>{t("settings:experimental.CONVERSATION_MEMORY.advancedFeature3")}</li>
									<li>{t("settings:experimental.CONVERSATION_MEMORY.advancedFeature4")}</li>
								</ul>
							</div>
						</div>
					)}

					{/* Status Messages */}
					{enabled && (
						<div className="space-y-2">
							{/* Warning if Code Index is not configured */}
							{(!codebaseIndexConfig?.codebaseIndexEnabled ||
								!codebaseIndexConfig?.codebaseIndexQdrantUrl) && (
								<div className="p-2 bg-vscode-editorWarning-background text-vscode-editorWarning-foreground rounded text-sm">
									{t("settings:experimental.CONVERSATION_MEMORY.warningQdrantConfig")}
								</div>
							)}

							{/* Info about memory usage */}
							<div className="p-2 bg-vscode-editorInfo-background text-vscode-editorInfo-foreground rounded text-sm">
								{t("settings:experimental.CONVERSATION_MEMORY.infoMemoryUsage")}
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
