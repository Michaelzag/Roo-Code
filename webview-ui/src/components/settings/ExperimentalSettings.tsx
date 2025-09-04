import { HTMLAttributes } from "react"
import { FlaskConical } from "lucide-react"

import type { Experiments } from "@roo-code/types"

import { EXPERIMENT_IDS, experimentConfigsMap } from "@roo/experiments"

import { useAppTranslation } from "@src/i18n/TranslationContext"
import { cn } from "@src/lib/utils"

import { SetExperimentEnabled } from "./types"
import { SectionHeader } from "./SectionHeader"
import { Section } from "./Section"
import { ExperimentalFeature } from "./ExperimentalFeature"
import { ImageGenerationSettings } from "./ImageGenerationSettings"
import { ConversationMemorySettings } from "./ConversationMemorySettings"

type ExperimentalSettingsProps = HTMLAttributes<HTMLDivElement> & {
	experiments: Experiments
	setExperimentEnabled: SetExperimentEnabled
	apiConfiguration?: any
	setApiConfigurationField?: any
	openRouterImageApiKey?: string
	openRouterImageGenerationSelectedModel?: string
	setOpenRouterImageApiKey?: (apiKey: string) => void
	setImageGenerationSelectedModel?: (model: string) => void
	conversationMemoryPromptBudgetTokens?: number
	conversationMemoryToolDefaultLimit?: number
	conversationMemoryDailyBudgetUSD?: number
	setConversationMemoryPromptBudgetTokens?: (tokens: number) => void
	setConversationMemoryToolDefaultLimit?: (limit: number) => void
	setConversationMemoryDailyBudgetUSD?: (budget: number) => void
	codebaseIndexConfig?: any
}

export const ExperimentalSettings = ({
	experiments,
	setExperimentEnabled,
	apiConfiguration,
	setApiConfigurationField,
	openRouterImageApiKey,
	openRouterImageGenerationSelectedModel,
	setOpenRouterImageApiKey,
	setImageGenerationSelectedModel,
	conversationMemoryPromptBudgetTokens,
	conversationMemoryToolDefaultLimit,
	conversationMemoryDailyBudgetUSD,
	setConversationMemoryPromptBudgetTokens,
	setConversationMemoryToolDefaultLimit,
	setConversationMemoryDailyBudgetUSD,
	codebaseIndexConfig,
	className,
	...props
}: ExperimentalSettingsProps) => {
	const { t } = useAppTranslation()

	return (
		<div className={cn("flex flex-col gap-2", className)} {...props}>
			<SectionHeader>
				<div className="flex items-center gap-2">
					<FlaskConical className="w-4" />
					<div>{t("settings:sections.experimental")}</div>
				</div>
			</SectionHeader>

			<Section>
				{Object.entries(experimentConfigsMap)
					.filter(([key]) => key in EXPERIMENT_IDS)
					.map((config) => {
						if (config[0] === "MULTI_FILE_APPLY_DIFF") {
							return (
								<ExperimentalFeature
									key={config[0]}
									experimentKey={config[0]}
									enabled={experiments[EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.MULTI_FILE_APPLY_DIFF, enabled)
									}
								/>
							)
						}
						if (
							config[0] === "IMAGE_GENERATION" &&
							setOpenRouterImageApiKey &&
							setImageGenerationSelectedModel
						) {
							return (
								<ImageGenerationSettings
									key={config[0]}
									enabled={experiments[EXPERIMENT_IDS.IMAGE_GENERATION] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.IMAGE_GENERATION, enabled)
									}
									openRouterImageApiKey={openRouterImageApiKey}
									openRouterImageGenerationSelectedModel={openRouterImageGenerationSelectedModel}
									setOpenRouterImageApiKey={setOpenRouterImageApiKey}
									setImageGenerationSelectedModel={setImageGenerationSelectedModel}
								/>
							)
						}
						if (
							config[0] === "CONVERSATION_MEMORY" &&
							setConversationMemoryPromptBudgetTokens &&
							setConversationMemoryToolDefaultLimit &&
							setConversationMemoryDailyBudgetUSD
						) {
							return (
								<ConversationMemorySettings
									key={config[0]}
									enabled={experiments[EXPERIMENT_IDS.CONVERSATION_MEMORY] ?? false}
									onChange={(enabled) =>
										setExperimentEnabled(EXPERIMENT_IDS.CONVERSATION_MEMORY, enabled)
									}
									promptBudgetTokens={conversationMemoryPromptBudgetTokens}
									memoryToolDefaultLimit={conversationMemoryToolDefaultLimit}
									dailyProcessingBudgetUSD={conversationMemoryDailyBudgetUSD}
									setPromptBudgetTokens={setConversationMemoryPromptBudgetTokens}
									setMemoryToolDefaultLimit={setConversationMemoryToolDefaultLimit}
									setDailyProcessingBudgetUSD={setConversationMemoryDailyBudgetUSD}
									codebaseIndexConfig={codebaseIndexConfig}
								/>
							)
						}
						return (
							<ExperimentalFeature
								key={config[0]}
								experimentKey={config[0]}
								enabled={experiments[EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS]] ?? false}
								onChange={(enabled) =>
									setExperimentEnabled(
										EXPERIMENT_IDS[config[0] as keyof typeof EXPERIMENT_IDS],
										enabled,
									)
								}
							/>
						)
					})}
			</Section>
		</div>
	)
}
