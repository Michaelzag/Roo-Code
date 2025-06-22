import type { MessageStyle, ColorName } from "../../../theme/chatDefaults"
import type { ClassificationFactory, ParsedMessage } from "../types"

/**
 * Classifier for agent response messages
 */
export class AgentResponseClassifier implements ClassificationFactory {
	name = "AgentResponseClassifier"
	priority = 70

	canClassify(parsed: ParsedMessage): boolean {
		return parsed.type === "agent-response"
	}

	classify(_parsed: ParsedMessage): MessageStyle {
		return {
			type: "standard",
			pattern: "bubble",
			semantic: "agent-response",
			color: "green" as ColorName,
			variant: "agent",
		}
	}
}
