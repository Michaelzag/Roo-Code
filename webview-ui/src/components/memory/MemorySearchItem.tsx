import React from "react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { MemorySearchItemProps } from "./types"

// Helper function to highlight search query matches
const highlightMatch = (text: string, query: string): React.ReactNode => {
	if (!query.trim()) return text

	const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
	const parts = text.split(regex)

	return parts.map((part, index) =>
		regex.test(part) ? (
			<mark key={index} className="bg-yellow-500/30 text-vscode-foreground">
				{part}
			</mark>
		) : (
			part
		),
	)
}

// Helper function to format date
const formatDate = (timestamp: Date): string => {
	const date = new Date(timestamp)
	const now = new Date()
	const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

	if (diffInHours < 1) {
		return "Just now"
	} else if (diffInHours < 24) {
		return `${Math.floor(diffInHours)}h ago`
	} else if (diffInHours < 168) {
		// 7 days
		return `${Math.floor(diffInHours / 24)}d ago`
	} else {
		return date.toLocaleDateString()
	}
}

// Helper function to get episode type icon
const getEpisodeTypeIcon = (episodeType: string): string => {
	switch (episodeType) {
		case "conversation":
			return "codicon-comment-discussion"
		case "fact":
			return "codicon-info"
		case "insight":
			return "codicon-lightbulb"
		default:
			return "codicon-circle-filled"
	}
}

// Helper function to get episode type color
const getEpisodeTypeColor = (episodeType: string): string => {
	switch (episodeType) {
		case "conversation":
			return "text-blue-400"
		case "fact":
			return "text-green-400"
		case "insight":
			return "text-yellow-400"
		default:
			return "text-vscode-descriptionForeground"
	}
}

export const MemorySearchItem: React.FC<MemorySearchItemProps> = ({ result, searchQuery, onSelect }) => {
	const { t } = useAppTranslation()

	const handleClick = () => {
		onSelect(result)
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault()
			onSelect(result)
		}
	}

	return (
		<div
			className="border-b border-vscode-panel-border p-3 hover:bg-vscode-list-hoverBackground cursor-pointer focus:outline-none focus:bg-vscode-list-activeSelectionBackground focus:text-vscode-list-activeSelectionForeground transition-colors"
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			tabIndex={0}
			role="button"
			aria-label={t("memory:item.selectLabel", "Select memory item")}>
			{/* Header with title and timestamp */}
			<div className="flex justify-between items-start mb-2">
				<h4 className="text-sm font-medium text-vscode-foreground line-clamp-2 flex-1 mr-2">
					{highlightMatch(result.title || t("memory:item.untitled", "Untitled"), searchQuery)}
				</h4>
				<span className="text-xs text-vscode-descriptionForeground whitespace-nowrap">
					{formatDate(result.timestamp)}
				</span>
			</div>

			{/* Content preview */}
			<p className="text-xs text-vscode-descriptionForeground mb-2 line-clamp-3">
				{highlightMatch(result.content, searchQuery)}
			</p>

			{/* Footer with metadata */}
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					{/* Episode type badge */}
					<span
						className={`inline-flex items-center gap-1 px-2 py-1 text-xs bg-vscode-button-background text-vscode-button-foreground rounded ${getEpisodeTypeColor(result.episodeType)}`}>
						<span className={`${getEpisodeTypeIcon(result.episodeType)} text-xs`} />
						{t(`memory:episodeType.${result.episodeType}`, result.episodeType)}
					</span>

					{/* Episode ID for reference */}
					<span className="text-xs text-vscode-descriptionForeground opacity-70">
						{t("memory:item.episode", "Episode")}: {result.episodeId.slice(0, 8)}...
					</span>
				</div>

				{/* Relevance score */}
				<div className="flex items-center gap-1">
					<span className="codicon codicon-star text-xs text-vscode-descriptionForeground" />
					<span className="text-xs text-vscode-descriptionForeground">
						{(result.relevanceScore * 100).toFixed(0)}%
					</span>
				</div>
			</div>
		</div>
	)
}
