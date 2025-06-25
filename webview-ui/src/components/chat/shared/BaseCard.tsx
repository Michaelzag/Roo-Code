import React from "react"
import { cn } from "@src/lib/utils"
import { DESIGN_SYSTEM } from "../theme/chatDefaults"

interface BaseCardProps {
	header?: React.ReactNode
	children: React.ReactNode
	className?: string
	borderColor?: string
	backgroundColor?: string
	shadowColor?: string
	onClick?: () => void
}

/**
 * BaseCard Component - Using Proven Design Tokens
 *
 * Foundation for all card-style components that preserves the exact visual
 * appearance of our beautiful current components while providing shared architecture.
 *
 * Uses extracted spacing values from TaskCompletedRow, ContextCondenseRow, ApiRequestCard
 * to ensure pixel-perfect consistency across all override components.
 */
export const BaseCard: React.FC<BaseCardProps> = ({
	header,
	children,
	className,
	borderColor = "var(--vscode-panel-border)",
	backgroundColor = "var(--vscode-input-background)",
	shadowColor,
	onClick,
}) => {
	return (
		<div
			className={cn("overflow-hidden position-relative", className)}
			style={{
				margin: DESIGN_SYSTEM.spacing.cardMargin,
				border: `${DESIGN_SYSTEM.borders.card} ${borderColor}`,
				borderRadius: DESIGN_SYSTEM.radius.card,
				background: backgroundColor,
				boxShadow: shadowColor ? `0 3px 12px color-mix(in srgb, ${shadowColor} 25%, transparent)` : undefined,
				cursor: onClick ? "pointer" : "default",
			}}
			onClick={onClick}>
			{header && <div style={{ padding: "16px 16px 12px" }}>{header}</div>}
			<div style={{ padding: DESIGN_SYSTEM.spacing.contentPadding, paddingTop: 0 }}>{children}</div>
		</div>
	)
}
