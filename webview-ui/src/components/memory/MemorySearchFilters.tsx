import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Slider } from "@src/components/ui"
import { MemorySearchFiltersProps } from "./types"

export const MemorySearchFilters: React.FC<MemorySearchFiltersProps> = ({ filters, setFilters }) => {
	const { t } = useAppTranslation()

	const handleTimeRangeChange = (value: string) => {
		setFilters({
			...filters,
			timeRange: value as "all" | "today" | "week" | "month",
		})
	}

	const handleEpisodeTypeChange = (value: string) => {
		setFilters({
			...filters,
			episodeType: value as "all" | "conversation" | "fact" | "insight",
		})
	}

	const handleRelevanceThresholdChange = ([value]: number[]) => {
		setFilters({
			...filters,
			relevanceThreshold: value,
		})
	}

	return (
		<div className="flex gap-2 flex-wrap">
			{/* Time Range Filter */}
			<Select value={filters.timeRange} onValueChange={handleTimeRangeChange}>
				<SelectTrigger className="flex-1 min-w-32">
					<SelectValue>
						{t("memory:filters.timeRange.prefix", { defaultValue: "Time:" })}{" "}
						{t(`memory:filters.timeRange.${filters.timeRange}`, { defaultValue: filters.timeRange })}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-history" />
							{t("memory:filters.timeRange.all", { defaultValue: "All Time" })}
						</div>
					</SelectItem>
					<SelectItem value="today">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-calendar" />
							{t("memory:filters.timeRange.today", { defaultValue: "Today" })}
						</div>
					</SelectItem>
					<SelectItem value="week">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-calendar" />
							{t("memory:filters.timeRange.week", { defaultValue: "This Week" })}
						</div>
					</SelectItem>
					<SelectItem value="month">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-calendar" />
							{t("memory:filters.timeRange.month", { defaultValue: "This Month" })}
						</div>
					</SelectItem>
				</SelectContent>
			</Select>

			{/* Episode Type Filter */}
			<Select value={filters.episodeType} onValueChange={handleEpisodeTypeChange}>
				<SelectTrigger className="flex-1 min-w-32">
					<SelectValue>
						{t("memory:filters.episodeType.prefix", { defaultValue: "Type:" })}{" "}
						{t(`memory:filters.episodeType.${filters.episodeType}`, { defaultValue: filters.episodeType })}
					</SelectValue>
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="all">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-list-unordered" />
							{t("memory:filters.episodeType.all", { defaultValue: "All Episodes" })}
						</div>
					</SelectItem>
					<SelectItem value="conversation">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-comment-discussion" />
							{t("memory:filters.episodeType.conversation", { defaultValue: "Conversations" })}
						</div>
					</SelectItem>
					<SelectItem value="fact">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-info" />
							{t("memory:filters.episodeType.fact", { defaultValue: "Facts" })}
						</div>
					</SelectItem>
					<SelectItem value="insight">
						<div className="flex items-center gap-2">
							<span className="codicon codicon-lightbulb" />
							{t("memory:filters.episodeType.insight", { defaultValue: "Insights" })}
						</div>
					</SelectItem>
				</SelectContent>
			</Select>

			{/* Relevance Threshold */}
			<div className="flex-1 min-w-48">
				<label className="text-sm text-vscode-foreground mb-1 block">
					{t("memory:filters.relevanceThreshold", { defaultValue: "Relevance" })}
					<span className="text-vscode-descriptionForeground ml-2">
						{Math.round(filters.relevanceThreshold * 100)}%
					</span>
				</label>
				<Slider
					value={[filters.relevanceThreshold]}
					onValueChange={handleRelevanceThresholdChange}
					min={0}
					max={1}
					step={0.1}
					className="w-full"
				/>
			</div>
		</div>
	)
}
