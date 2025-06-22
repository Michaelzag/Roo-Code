import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"
import { safeJsonParse } from "@roo/safeJsonParse"
import { AutoFormattedContent, ThemedList } from "./shared/ThemedComponents"

/**
 * ApiContent - Uses shared simple content with enhanced API request formatting
 */
const ApiContent: React.FC<{
	message: ClineMessage
	classification: MessageStyle
	expanded?: boolean
	onToggleExpand?: () => void
}> = ({ message, classification }) => {
	// Parse API request data
	const apiData = safeJsonParse(message.text) as any
	const tool = apiData?.tool || "Unknown API"
	const method = apiData?.method || "REQUEST"

	const renderApiContent = () => {
		const apiInfo = [
			`🌐 **Operation:** ${tool}`,
			`📡 **Method:** ${method}`,
			`⏱️ **Time:** ${new Date(message.ts).toLocaleTimeString()}`,
		]

		return (
			<div className="space-y-3">
				{/* API Operation Badge */}
				<div className="flex items-center gap-2 mb-3">
					<span
						className="px-2 py-1 rounded-md text-xs font-semibold"
						style={{
							background: "var(--semantic-accent-color, var(--vscode-charts-orange))20",
							color: "var(--semantic-text-accent, var(--vscode-foreground))",
							border: "1px solid var(--semantic-border-color, var(--vscode-panel-border))40",
						}}>
						API Request
					</span>
				</div>

				{/* API Details */}
				<ThemedList semantic="api" items={apiInfo} />

				{/* Full request data if needed */}
				{apiData && Object.keys(apiData).length > 2 && (
					<details className="mt-3">
						<summary className="text-xs opacity-60 cursor-pointer hover:opacity-80">
							Show full request data
						</summary>
						<AutoFormattedContent semantic="api" content={apiData} className="mt-2 text-xs" />
					</details>
				)}
			</div>
		)
	}

	return (
		<SimpleBubbleContent
			message={message}
			classification={classification}
			icon="cloud"
			title="API Request"
			renderContent={renderApiContent}
		/>
	)
}

/**
 * ApiBubble - Uses shared bubble factory with api semantic
 */
export const ApiBubble = createBubbleComponent<{
	expanded?: boolean
	onToggleExpand?: () => void
}>(
	"api",
	"orange",
)(ApiContent)
