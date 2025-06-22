import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Markdown } from "../../Markdown"

interface TaskCompletedRowProps {
	text?: string
}

/**
 * TaskCompletedRow - Displays successful task completion with celebration styling
 *
 * Features a celebratory design with gradients, animations, and success indicators.
 */
export const TaskCompletedRow = ({ text }: TaskCompletedRowProps) => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(true) // Expanded by default

	const greenColor = "#10b981" // Primary success green
	const darkGreenColor = "#059669" // Darker green for borders
	const goldColor = "#f59e0b" // Gold accent for celebration

	return (
		<div
			style={{
				margin: "12px 0",
				border: `2px solid ${darkGreenColor}`,
				borderRadius: "8px",
				background: `color-mix(in srgb, ${greenColor} 8%, var(--vscode-editor-background))`,
				boxShadow: `0 3px 12px color-mix(in srgb, ${greenColor} 25%, transparent)`,
				overflow: "hidden",
				position: "relative" as const,
			}}>
			{/* Top celebration accent line */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: "3px",
					background: `linear-gradient(90deg, ${darkGreenColor}, ${greenColor}, ${darkGreenColor})`,
				}}
			/>

			{/* Header */}
			<div
				className="flex items-center justify-between gap-3 p-4 cursor-pointer transition-all duration-200"
				onClick={() => setIsExpanded(!isExpanded)}>
				<div className="flex items-center gap-3">
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "28px",
							height: "28px",
							borderRadius: "50%",
							background: `linear-gradient(45deg, ${greenColor}, ${goldColor})`,
							border: `2px solid ${darkGreenColor}`,
							boxShadow: `0 2px 8px color-mix(in srgb, ${goldColor} 40%, transparent)`,
						}}>
						<span
							className="codicon codicon-check"
							style={{
								color: "white",
								fontSize: "16px",
								fontWeight: "bold",
							}}
						/>
					</div>
					<span
						style={{
							color: "var(--vscode-foreground)",
							fontWeight: "700",
							fontSize: "18px",
							textShadow: `0 1px 2px color-mix(in srgb, ${goldColor} 20%, transparent)`,
						}}>
						🎉 {t("chat:taskCompleted")}
					</span>
				</div>

				<div className="flex items-center gap-3">
					<div
						style={{
							background: `linear-gradient(45deg, ${greenColor}, ${goldColor})`,
							borderRadius: "12px",
							padding: "6px 12px",
							color: "white",
							fontWeight: "700",
							fontSize: "13px",
							textShadow: "0 1px 2px rgba(0,0,0,0.3)",
							boxShadow: `0 2px 6px color-mix(in srgb, ${goldColor} 30%, transparent)`,
						}}>
						✨ SUCCESS
					</div>

					<span
						className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
						style={{
							fontSize: "16px",
							color: greenColor,
							transition: "transform 0.2s ease",
						}}
					/>
				</div>
			</div>

			{isExpanded && text && (
				<div
					style={{
						padding: "20px",
						borderTop: `1px solid color-mix(in srgb, ${greenColor} 20%, transparent)`,
						backgroundColor: "var(--vscode-textCodeBlock-background)",
					}}>
					<div
						style={{
							fontSize: "14px",
							color: "var(--vscode-foreground)",
							lineHeight: "1.6",
							padding: "16px",
							background: `color-mix(in srgb, ${greenColor} 3%, var(--vscode-input-background))`,
							borderRadius: "6px",
							border: `1px solid color-mix(in srgb, ${greenColor} 20%, var(--vscode-input-border))`,
						}}>
						<Markdown markdown={text} />
					</div>
				</div>
			)}
		</div>
	)
}
