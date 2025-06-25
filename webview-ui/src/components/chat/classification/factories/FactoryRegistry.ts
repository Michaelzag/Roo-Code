import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import type { ParsedMessage, MessageParserFactory, ClassificationFactory, FactoryRegistry } from "./types"

/**
 * Central registry for message parsing and classification factories
 * Implements the factory pattern to replace monolithic classification logic
 */
export class MessageFactoryRegistry implements FactoryRegistry {
	private parsers: MessageParserFactory[] = []
	private classifiers: ClassificationFactory[] = []

	// Parser management
	registerParser(parser: MessageParserFactory): void {
		// Remove existing parser with same name
		this.unregisterParser(parser.name)

		// Insert in priority order (highest first)
		const insertIndex = this.parsers.findIndex((p) => p.priority < parser.priority)
		if (insertIndex === -1) {
			this.parsers.push(parser)
		} else {
			this.parsers.splice(insertIndex, 0, parser)
		}
	}

	unregisterParser(name: string): void {
		const index = this.parsers.findIndex((p) => p.name === name)
		if (index !== -1) {
			this.parsers.splice(index, 1)
		}
	}

	findParser(message: ClineMessage): MessageParserFactory | null {
		return this.parsers.find((parser) => parser.canParse(message)) || null
	}

	// Classifier management
	registerClassifier(classifier: ClassificationFactory): void {
		// Remove existing classifier with same name
		this.unregisterClassifier(classifier.name)

		// Insert in priority order (highest first)
		const insertIndex = this.classifiers.findIndex((c) => c.priority < classifier.priority)
		if (insertIndex === -1) {
			this.classifiers.push(classifier)
		} else {
			this.classifiers.splice(insertIndex, 0, classifier)
		}
	}

	unregisterClassifier(name: string): void {
		const index = this.classifiers.findIndex((c) => c.name === name)
		if (index !== -1) {
			this.classifiers.splice(index, 1)
		}
	}

	findClassifier(parsed: ParsedMessage): ClassificationFactory | null {
		return this.classifiers.find((classifier) => classifier.canClassify(parsed)) || null
	}

	// Processing pipeline
	parseMessage(message: ClineMessage): ParsedMessage {
		const parser = this.findParser(message)
		if (parser) {
			return parser.parse(message)
		}

		// Fallback parser for unknown message types
		return {
			raw: message,
			type: "unknown",
			text: message.text,
			isPartial: message.partial,
			timestamp: message.ts,
		}
	}

	classifyMessage(message: ClineMessage): MessageStyle {
		// Parse first, then classify based on structured data
		const parsed = this.parseMessage(message)

		const classifier = this.findClassifier(parsed)
		if (classifier) {
			return classifier.classify(parsed)
		}

		// Fallback classification for unknown types
		return {
			type: "standard",
			pattern: "bubble",
			semantic: "search",
			color: "pink",
			variant: "work",
		}
	}

	// Debugging helpers
	getRegisteredParsers(): Array<{ name: string; priority: number }> {
		return this.parsers.map((p) => ({ name: p.name, priority: p.priority }))
	}

	getRegisteredClassifiers(): Array<{ name: string; priority: number }> {
		return this.classifiers.map((c) => ({ name: c.name, priority: c.priority }))
	}
}

// Global registry instance
export const messageFactoryRegistry = new MessageFactoryRegistry()
