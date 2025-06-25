import React from "react"
import { useTranslation } from "react-i18next"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../theme/chatDefaults"
import type { ClineSayTool } from "@roo/ExtensionMessage"

interface FileOperationsProps {
	message: ClineMessage
	classification: MessageStyle
	tool: ClineSayTool
	isExpanded?: boolean
	isLast?: boolean
	isStreaming?: boolean
	onToggleExpand?: (ts: number) => void
	onBatchFileResponse?: (response: { [key: string]: boolean }) => void
}

/**
 * FileOperations - Component for file operation displays
 *
 * Handles file read, write, edit, search, and list operations.
 * Used by FileOperationContent and WorkCard for file-related tools.
 */
export const FileOperations: React.FC<FileOperationsProps> = ({
	message: _message,
	classification: _classification,
	tool,
	isExpanded: _isExpanded,
	isLast: _isLast,
	isStreaming: _isStreaming,
	onToggleExpand: _onToggleExpand,
	onBatchFileResponse: _onBatchFileResponse,
}) => {
	const { t } = useTranslation()

	// Get operation header text based on tool type - keep it simple like original
	const getHeaderText = () => {
		switch (tool.tool) {
			case "readFile":
				return tool.batchFiles
					? t("chat:fileOperations.wantsToReadMultiple")
					: t("chat:fileOperations.wantsToRead")
			case "appliedDiff":
			case "editedExistingFile":
				return t("chat:fileOperations.wantsToEdit")
			case "newFileCreated":
				return t("chat:fileOperations.wantsToCreate")
			case "searchFiles":
				return t("chat:directoryOperations.wantsToSearch", { regex: tool.regex || "" })
			case "listFilesTopLevel":
				return t("chat:directoryOperations.wantsToViewTopLevel")
			case "listFilesRecursive":
				return t("chat:directoryOperations.wantsToViewRecursive")
			default:
				return "File operation"
		}
	}

	// Render file list - keep compact like original
	const renderFileList = () => {
		if (tool.batchFiles && Array.isArray(tool.batchFiles)) {
			return (
				<div style={{ paddingLeft: "16px", fontSize: "13px" }}>
					{tool.batchFiles.map((file, index) => (
						<div key={index} style={{ display: "flex", alignItems: "center", marginBottom: "2px" }}>
							<span
								className="codicon codicon-file"
								style={{ marginRight: "6px", fontSize: "12px", opacity: 0.7 }}
							/>
							<span style={{ fontFamily: "var(--vscode-editor-font-family)" }}>{file.path}</span>
						</div>
					))}
				</div>
			)
		}

		if (tool.path) {
			return (
				<div style={{ paddingLeft: "16px", fontSize: "13px" }}>
					<div style={{ display: "flex", alignItems: "center" }}>
						<span
							className="codicon codicon-file"
							style={{ marginRight: "6px", fontSize: "12px", opacity: 0.7 }}
						/>
						<span style={{ fontFamily: "var(--vscode-editor-font-family)" }}>{tool.path}</span>
					</div>
				</div>
			)
		}

		return null
	}

	return (
		<div>
			{/* Simple header text like original */}
			<div
				style={{
					fontSize: "14px",
					color: "var(--vscode-foreground)",
					marginBottom: "4px",
					paddingLeft: "4px",
				}}>
				{getHeaderText()}
			</div>

			{/* File list - compact like original */}
			{renderFileList()}
		</div>
	)
}
