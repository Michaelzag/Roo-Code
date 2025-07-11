import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Markdown } from "../../Markdown"
import { ProgressIndicator } from "../../ProgressIndicator"
import { DESIGN_SYSTEM } from "../../theme/chatDefaults"
import type { ContextCondense } from "@roo-code/types"

/**
 * ContextCondenseRow - Displays context condensation results with token savings and summary
 *
 * Shows token reduction statistics, cost information, and the generated summary.
 */
export const ContextCondenseRow = ({ cost, prevContextTokens, newContextTokens, summary }: ContextCondense) => {
	const { t } = useTranslation()
	const [isExpanded, setIsExpanded] = useState(true) // Expanded by default

	const pinkColor = "#ec4899" // Better contrast pink
	const darkPinkColor = "#be185d" // Darker pink for borders

	const tokensSaved = prevContextTokens - newContextTokens
	const percentageReduced = Math.round((tokensSaved / prevContextTokens) * 100)

	return (
		<div
			style={{
				margin: DESIGN_SYSTEM.spacing.cardMargin,
				border: `2px solid ${darkPinkColor}`,
				borderRadius: "8px",
				background: `color-mix(in srgb, ${pinkColor} 8%, var(--vscode-editor-background))`,
				boxShadow: `0 3px 12px color-mix(in srgb, ${pinkColor} 25%, transparent)`,
				overflow: "hidden",
				position: "relative" as const,
			}}>
			{/* Top accent line */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					height: "2px",
					background: `linear-gradient(90deg, ${darkPinkColor}, ${pinkColor}, ${darkPinkColor})`,
				}}
			/>

			{/* Header */}
			<div
				className={`flex items-center justify-between ${DESIGN_SYSTEM.spacing.componentElementGap} ${DESIGN_SYSTEM.spacing.overrideHeaderPadding} cursor-pointer transition-all duration-200`}
				onClick={() => setIsExpanded(!isExpanded)}>
				<div className={`flex items-center ${DESIGN_SYSTEM.spacing.componentElementGap}`}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							width: "24px",
							height: "24px",
							borderRadius: "50%",
							background: pinkColor,
							border: `2px solid ${darkPinkColor}`,
						}}>
						<span
							className="codicon codicon-symbol-method"
							style={{
								color: "white",
								fontSize: "14px",
								fontWeight: "bold",
							}}
						/>
					</div>
					<span
						style={{
							color: "var(--vscode-foreground)",
							fontWeight: "700",
							fontSize: "16px",
						}}>
						{t("chat:contextCondense.title")}
					</span>
					{cost > 0 && (
						<div
							style={{
								background: `color-mix(in srgb, ${pinkColor} 20%, var(--vscode-editor-background))`,
								border: `1px solid ${pinkColor}`,
								borderRadius: "12px",
								padding: DESIGN_SYSTEM.spacing.badgePaddingLg,
								color: darkPinkColor,
								fontWeight: "700",
								fontSize: "13px",
							}}>
							${cost.toFixed(4)}
						</div>
					)}
				</div>

				<div className={`flex items-center ${DESIGN_SYSTEM.spacing.componentElementGap}`}>
					{/* Token reduction info with better contrast */}
					<div
						style={{
							color: "var(--vscode-foreground)",
							fontSize: "14px",
							fontWeight: "600",
						}}>
						{prevContextTokens.toLocaleString()} → {newContextTokens.toLocaleString()} tokens
					</div>

					<span
						className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
						style={{
							fontSize: "16px",
							color: pinkColor,
							transition: "transform 0.2s ease",
						}}
					/>
				</div>
			</div>

			{isExpanded && (
				<div
					className={DESIGN_SYSTEM.spacing.componentContentPadding}
					style={{
						borderTop: `1px solid color-mix(in srgb, ${pinkColor} 20%, transparent)`,
						backgroundColor: "var(--vscode-textCodeBlock-background)",
					}}>
					{/* Condensing results summary */}
					<div
						className={DESIGN_SYSTEM.spacing.componentBadgeMargin}
						style={{
							padding: DESIGN_SYSTEM.spacing.innerPadding,
							background: `color-mix(in srgb, ${pinkColor} 5%, var(--vscode-editor-background))`,
							borderRadius: "6px",
							border: `1px solid color-mix(in srgb, ${pinkColor} 20%, transparent)`,
						}}>
						<h4
							style={{
								margin: "0 0 8px 0",
								color: darkPinkColor,
								fontSize: "14px",
								fontWeight: "700",
							}}>
							Condensing Results
						</h4>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
								gap: DESIGN_SYSTEM.spacing.innerPadding,
								fontSize: "13px",
								color: "var(--vscode-foreground)",
							}}>
							<div>
								<strong>Tokens Saved:</strong>
								<br />
								<span style={{ color: pinkColor, fontWeight: "600" }}>
									{tokensSaved.toLocaleString()} ({percentageReduced}%)
								</span>
							</div>
							<div>
								<strong>Before:</strong>
								<br />
								{prevContextTokens.toLocaleString()} tokens
							</div>
							<div>
								<strong>After:</strong>
								<br />
								{newContextTokens.toLocaleString()} tokens
							</div>
							{cost > 0 && (
								<div>
									<strong>Cost:</strong>
									<br />${cost.toFixed(4)}
								</div>
							)}
						</div>
					</div>

					{/* Show the actual summary generated by the agent */}
					{summary && (
						<div>
							<h4
								style={{
									margin: `0 0 ${DESIGN_SYSTEM.spacing.innerPadding} 0`,
									color: "var(--vscode-foreground)",
									fontSize: "14px",
									fontWeight: "600",
								}}>
								Condensed Summary
							</h4>
							<div
								style={{
									fontSize: "13px",
									color: "var(--vscode-foreground)",
									lineHeight: "1.6",
									padding: DESIGN_SYSTEM.spacing.innerPadding,
									background: "var(--vscode-input-background)",
									borderRadius: "4px",
									border: "1px solid var(--vscode-input-border)",
								}}>
								<Markdown markdown={summary} />
							</div>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

export const CondensingContextRow = () => {
	const { t } = useTranslation()
	return (
		<div className="flex items-center gap-2">
			<ProgressIndicator />
			<span className="codicon codicon-compress text-blue-400" />
			<span className="font-bold text-vscode-foreground">{t("chat:contextCondense.condensing")}</span>
		</div>
	)
}

export const CondenseContextErrorRow = ({ errorText }: { errorText?: string }) => {
	const { t } = useTranslation()
	return (
		<div className="flex flex-col gap-1">
			<div className="flex items-center gap-2">
				<span className="codicon codicon-warning text-vscode-editorWarning-foreground opacity-80 text-base -mb-0.5"></span>
				<span className="font-bold text-vscode-foreground">{t("chat:contextCondense.errorHeader")}</span>
			</div>
			<span className="text-vscode-descriptionForeground text-sm">{errorText}</span>
		</div>
	)
}
