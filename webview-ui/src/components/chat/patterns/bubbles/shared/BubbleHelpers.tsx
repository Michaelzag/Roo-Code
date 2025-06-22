import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle, ColorName, SemanticType } from "../../../theme/chatDefaults"
import { getSemanticTheme } from "../../../theme/chatDefaults"
import { BubbleUnified } from "../../BubbleUnified"

/**
 * Helper to create work classification with semantic override
 */
export function createWorkClassification(
	semantic: SemanticType,
	color: ColorName = "blue",
	baseClassification?: MessageStyle,
): MessageStyle {
	return {
		type: baseClassification?.type || "standard",
		pattern: baseClassification?.pattern || "bubble",
		color: baseClassification?.color || color,
		semantic: semantic,
		variant: "work",
		component: baseClassification?.component,
		theme: baseClassification?.theme,
	}
}

/**
 * Higher-order component that wraps content with BubbleUnified
 */
export function createBubbleComponent<T extends object>(semantic: SemanticType, defaultColor: ColorName = "blue") {
	return (ContentComponent: React.ComponentType<any>) => {
		const BubbleComponent: React.FC<
			T & {
				message: ClineMessage
				classification?: MessageStyle
				children?: React.ReactNode
				className?: string
			}
		> = ({ message, classification, children, className, ...props }) => {
			const bubbleClassification = createWorkClassification(semantic, defaultColor, classification)

			return (
				<BubbleUnified
					message={message}
					classification={bubbleClassification}
					contentComponent={ContentComponent}
					contentProps={{ ...props, classification: bubbleClassification }}
					className={className}>
					{children}
				</BubbleUnified>
			)
		}

		return BubbleComponent
	}
}

/**
 * Simple factory for creating basic bubbles with standard content
 */
export function createSimpleBubble(semantic: SemanticType, icon: string, title: string, color: ColorName = "blue") {
	const ContentComponent: React.FC<{
		message: ClineMessage
		classification: MessageStyle
	}> = ({ message, classification }) => {
		const semanticTheme = getSemanticTheme(classification?.semantic)

		return (
			<div className="overflow-hidden">
				<div
					className="flex items-center py-3 px-4 text-white"
					style={{
						background: semanticTheme.headerGradient,
						textShadow: "0 1px 2px rgba(0,0,0,0.2)",
					}}>
					<span className={`codicon codicon-${icon} mr-2 text-sm text-white`} />
					<span className="text-sm font-medium text-white">{title}</span>
				</div>

				<div className="p-4 text-sm text-vscode-foreground leading-relaxed">{message.text}</div>
			</div>
		)
	}

	return createBubbleComponent(semantic, color)(ContentComponent)
}
