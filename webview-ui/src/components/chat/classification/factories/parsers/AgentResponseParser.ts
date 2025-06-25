import type { ClineMessage } from "@roo-code/types"
import type { MessageParserFactory, ParsedMessage } from "../types"

/**
 * Parser for agent text responses
 */
export class AgentResponseParser implements MessageParserFactory {
	name = "AgentResponseParser"
	priority = 70

	canParse(message: ClineMessage): boolean {
		return message.type === "say" && message.say === "text"
	}

	parse(message: ClineMessage): ParsedMessage {
		return {
			raw: message,
			type: "agent-response",
			text: message.text,
			isPartial: message.partial,
			timestamp: message.ts,
		}
	}
}
