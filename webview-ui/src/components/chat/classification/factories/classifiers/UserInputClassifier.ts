import type { MessageStyle, ColorName } from "../../../theme/chatDefaults"
import type { ClassificationFactory, ParsedMessage } from "../types"

/**
 * Classifier for user input messages
 */
export class UserInputClassifier implements ClassificationFactory {
	name = "UserInputClassifier"
	priority = 80

	canClassify(parsed: ParsedMessage): boolean {
		return parsed.type === "user-input" && !!parsed.userInput
	}

	classify(_parsed: ParsedMessage): MessageStyle {
		return {
			type: "standard",
			pattern: "bubble",
			semantic: "user-input",
			color: "blue" as ColorName,
			variant: "user",
		}
	}
}
