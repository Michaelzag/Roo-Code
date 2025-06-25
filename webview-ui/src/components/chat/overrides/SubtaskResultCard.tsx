import React from "react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import { cn } from "@src/lib/utils"
import { useChatTheme } from "../theme/useChatTheme"
import MarkdownBlock from "../../common/MarkdownBlock"

interface SubtaskResultCardProps {
	message: ClineMessage
	className?: string
}

export const SubtaskResultCard: React.FC<SubtaskResultCardProps> = ({ message, className }) => {
	const { t } = useTranslation()
	const { semanticColors } = useChatTheme()

	// This is semantically a mode-change but styled as completion (green)
	const colors = semanticColors.green

	return (
		<div className={cn("border-l-4 bg-opacity-10 px-3 py-2 my-1.5", colors.border, colors.background, className)}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "6px",
					marginBottom: "8px",
					color: colors.icon,
					fontSize: "14px",
					fontWeight: "600",
				}}>
				<span className="codicon codicon-check" style={{ fontSize: 16 }} />
				<span>{t("chat:subtasks.resultContent")}</span>
			</div>
			<div
				style={{
					color: "var(--vscode-foreground)",
					fontSize: "14px",
					lineHeight: "1.6",
				}}>
				<MarkdownBlock markdown={message.text} />
			</div>
		</div>
	)
}
