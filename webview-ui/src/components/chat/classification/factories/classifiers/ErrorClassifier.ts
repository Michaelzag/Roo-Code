import type { MessageStyle, ColorName } from "../../../theme/chatDefaults"
import type { ClassificationFactory, ParsedMessage } from "../types"

/**
 * Classifier for error messages
 * Implements intelligent error handling to solve duplicate error bubble issue
 */
export class ErrorClassifier implements ClassificationFactory {
	name = "ErrorClassifier"
	priority = 90

	canClassify(parsed: ParsedMessage): boolean {
		return parsed.type === "error" && !!parsed.error
	}

	classify(parsed: ParsedMessage): MessageStyle {
		const error = parsed.error!

		// Handle generic errors with special logic to prevent duplication
		if (error.isGeneric && error.hasSpecificError) {
			// Suppress generic errors by using minimal status-bar pattern
			return {
				type: "standard",
				pattern: "status-bar",
				semantic: "error",
				color: "red" as ColorName,
			}
		}

		// For specific errors or standalone generic errors, show full bubble
		return {
			type: "standard",
			pattern: "bubble",
			semantic: "error",
			color: "red" as ColorName,
			variant: "work",
		}
	}
}
