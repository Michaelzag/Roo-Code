import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../theme/chatDefaults"
import type { ClineSayTool } from "@roo/ExtensionMessage"

interface ModeSwitchProps {
	message: ClineMessage
	classification: MessageStyle
	tool: ClineSayTool
}

/**
 * ModeSwitch - Simple component for mode switching operations
 *
 * Displays mode switching requests and information.
 * Used by ModeChangeBubble and WorkCard for mode switching operations.
 */
export const ModeSwitch: React.FC<ModeSwitchProps> = ({ message, classification: _classification, tool }) => {
	// Extract mode from tool or message text
	const getMode = () => {
		if (tool.mode) {
			return tool.mode
		}

		// Parse from message text as fallback
		if (message.text) {
			const match = message.text.match(/switch_mode to '([^']+)'/i)
			if (match) {
				return match[1]
			}
		}

		return "unknown"
	}

	// Extract reason from tool or message text
	const getReason = () => {
		if (tool.reason) {
			return tool.reason
		}

		// Parse from message text as fallback
		if (message.text) {
			const match = message.text.match(/because:\s*(.+)/i)
			if (match) {
				return match[1]
			}
		}

		return null
	}

	const mode = getMode()
	const reason = getReason()

	// Get mode display name with emoji like original
	const getModeDisplay = (modeSlug: string) => {
		const modeMap: Record<string, string> = {
			code: "💻 Code",
			architect: "🏗️ Architect",
			ask: "❓ Ask",
			debug: "🪲 Debug",
			orchestrator: "🪃 Orchestrator",
			"mode-writer": "✍️ Mode Writer",
			test: "🧪 Test",
			"design-engineer": "🎨 Design Engineer",
			"release-engineer": "🚀 Release Engineer",
			translate: "🌐 Translate",
			"issue-fixer": "🔧 Issue Fixer",
			"issue-writer": "📝 Issue Writer",
			"integration-tester": "🧪 Integration Tester",
			"pr-reviewer": "🔍 PR Reviewer",
			"docs-extractor": "📚 Docs Extractor",
			boomerang: "Boomerang",
		}

		return modeMap[modeSlug] || modeSlug
	}

	return (
		<div>
			{/* Mode display - compact like original */}
			<div
				style={{
					display: "flex",
					alignItems: "center",
					fontSize: "14px",
					color: "var(--vscode-foreground)",
					marginBottom: reason ? "4px" : "0",
				}}>
				<span className="codicon codicon-arrow-swap" style={{ marginRight: "6px", fontSize: "12px" }} />
				<span style={{ fontWeight: "500" }}>{getModeDisplay(mode)}</span>
				<span style={{ marginLeft: "6px", opacity: 0.7, fontSize: "13px" }}>mode</span>
			</div>

			{/* Reason - if available, compact like original */}
			{reason && (
				<div
					style={{
						fontSize: "13px",
						color: "var(--vscode-descriptionForeground)",
						paddingLeft: "18px",
						fontStyle: "italic",
					}}>
					{reason}
				</div>
			)}
		</div>
	)
}
