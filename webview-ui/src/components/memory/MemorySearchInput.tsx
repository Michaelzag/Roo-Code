import React from "react"
import { VSCodeTextField } from "@vscode/webview-ui-toolkit/react"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { MemorySearchInputProps } from "./types"

export const MemorySearchInput: React.FC<MemorySearchInputProps> = ({
	searchQuery,
	setSearchQuery,
	onSearch,
	isSearching,
}) => {
	const { t } = useAppTranslation()

	const handleInput = (e: Event) => {
		const newValue = (e.target as HTMLInputElement)?.value || ""
		setSearchQuery(newValue)
	}

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && searchQuery.trim()) {
			onSearch()
		}
	}

	return (
		<VSCodeTextField
			className="w-full"
			placeholder={t("memory:searchPlaceholder", { defaultValue: "Search conversation memories..." })}
			value={searchQuery}
			data-testid="memory-search-input"
			onInput={handleInput as any}
			onKeyDown={handleKeyDown as any}
			disabled={isSearching}>
			<div slot="start" className="codicon codicon-search mt-0.5 opacity-80 text-sm!" />
			{searchQuery && (
				<div
					className="input-icon-button codicon codicon-close flex justify-center items-center h-full"
					aria-label={t("common:clearSearch", { defaultValue: "Clear search" })}
					onClick={() => setSearchQuery("")}
					slot="end"
				/>
			)}
		</VSCodeTextField>
	)
}
