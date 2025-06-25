import type { MessageStyle, SemanticType, ColorName } from "../../../theme/chatDefaults"
import type { ClassificationFactory, ParsedMessage } from "../types"

/**
 * Classifier for tool operations
 * Routes successful operations to appropriate semantic types
 * Handles failed operations as errors
 */
export class ToolOperationClassifier implements ClassificationFactory {
	name = "ToolOperationClassifier"
	priority = 100

	canClassify(parsed: ParsedMessage): boolean {
		return parsed.type === "tool-operation" && !!parsed.tool
	}

	classify(parsed: ParsedMessage): MessageStyle {
		const tool = parsed.tool!

		// Handle failed operations as errors
		if (!tool.isSuccess) {
			return {
				type: "standard",
				pattern: "bubble",
				semantic: "error",
				color: "red",
				variant: "work",
			}
		}

		// Route successful operations to appropriate semantic types
		const semantic = this.getSemanticForTool(tool.name)

		return {
			type: "standard",
			pattern: "bubble",
			semantic,
			color: this.getColorForSemantic(semantic),
			variant: "work",
		}
	}

	private getSemanticForTool(toolName: string): SemanticType {
		// Use the same semantic mapping logic from the original system
		// but now it's centralized and testable

		// File write operations
		if (
			/^(write_to_file|writeTo|writeFile|apply_diff|appliedDiff|applyDiff|insert_content|insertContent|search_and_replace|searchAndReplace|create.*file|edit|newFileCreated|editedExistingFile)$/i.test(
				toolName,
			)
		) {
			return "file-write"
		}

		// File read operations
		if (/^(read_file|readFile|get_file|getFile|file.*content)$/i.test(toolName)) {
			return "file-read"
		}

		// File search operations
		if (
			/^(search_files|searchFiles|list_files|listFiles|listFilesTopLevel|listFilesRecursive|list.*file|search.*file)$/i.test(
				toolName,
			)
		) {
			return "file-search"
		}

		// Codebase search
		if (
			/^(codebase.*search|codebaseSearch|search.*code|find.*code|listCodeDefinitionNames|fetchInstructions)$/i.test(
				toolName,
			)
		) {
			return "codebase-search"
		}

		// Command operations
		if (/^(command|execute|execute_command|run|terminal)$/i.test(toolName)) {
			return "command"
		}

		// Mode changes
		if (/^(mode|switch|task|new_task|newTask|switch_mode|switchMode)$/i.test(toolName)) {
			return "mode-change"
		}

		// Completion operations
		if (/^(complete|success|done|result|finish|finishTask)$/i.test(toolName)) {
			return "completion"
		}

		// Default fallback
		return "search"
	}

	private getColorForSemantic(semantic: SemanticType): ColorName {
		const colorMap: Record<SemanticType, ColorName> = {
			thinking: "yellow",
			error: "red",
			"file-read": "cyan",
			"file-write": "orange",
			"file-search": "teal",
			"codebase-search": "indigo",
			"mode-change": "purple",
			command: "gray",
			completion: "green",
			search: "pink",
			"user-input": "blue",
			"agent-response": "green",
			browser: "blue",
			mcp: "purple",
			api: "orange",
			subtask: "cyan",
			context: "gray",
			checkpoint: "green",
		}

		return colorMap[semantic] || ("pink" as ColorName)
	}
}
