import type { ClineMessage } from "@roo-code/types"
import type { MessageParserFactory, ParsedMessage, ParsedUserInput } from "../types"

/**
 * Parser for user input messages
 */
export class UserInputParser implements MessageParserFactory {
	name = "UserInputParser"
	priority = 80

	canParse(message: ClineMessage): boolean {
		return message.type === "say" && (message.say === "user_feedback" || message.say === "user_feedback_diff")
	}

	parse(message: ClineMessage): ParsedMessage {
		const parsedUserInput: ParsedUserInput = {
			text: message.text || "",
			hasImages: !!(message.images && message.images.length > 0),
			isDiff: message.say === "user_feedback_diff",
		}

		return {
			raw: message,
			type: "user-input",
			userInput: parsedUserInput,
			text: message.text,
			timestamp: message.ts,
		}
	}
}
