import { useCallback, useMemo } from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../theme/chatDefaults"
import {
	messageFactoryRegistry,
	ToolOperationParser,
	ErrorMessageParser,
	UserInputParser,
	AgentResponseParser,
	ComprehensiveParser,
	ToolOperationClassifier,
	ErrorClassifier,
	UserInputClassifier,
	AgentResponseClassifier,
	ComprehensiveClassifier,
} from "./factories"

/**
 * Factory-based message classification hook
 * Replaces the monolithic classification system with composable factories
 */
export const useFactoryMessageClassification = () => {
	// Initialize the registry with core parsers and classifiers
	const registry = useMemo(() => {
		// Register parsers (order matters due to priority)
		messageFactoryRegistry.registerParser(new ToolOperationParser())
		messageFactoryRegistry.registerParser(new ErrorMessageParser())
		messageFactoryRegistry.registerParser(new UserInputParser())
		messageFactoryRegistry.registerParser(new AgentResponseParser())
		messageFactoryRegistry.registerParser(new ComprehensiveParser()) // Fallback for all other messages

		// Register classifiers (order matters due to priority)
		messageFactoryRegistry.registerClassifier(new ToolOperationClassifier())
		messageFactoryRegistry.registerClassifier(new ErrorClassifier())
		messageFactoryRegistry.registerClassifier(new UserInputClassifier())
		messageFactoryRegistry.registerClassifier(new AgentResponseClassifier())
		messageFactoryRegistry.registerClassifier(new ComprehensiveClassifier()) // Fallback for all other messages

		return messageFactoryRegistry
	}, [])

	const classifyMessage = useCallback(
		(message: ClineMessage): MessageStyle => {
			try {
				return registry.classifyMessage(message)
			} catch (error) {
				console.error("Factory classification failed:", error, { message })

				// Fallback to safe default
				return {
					type: "standard",
					pattern: "bubble",
					semantic: "search",
					color: "pink",
					variant: "work",
				}
			}
		},
		[registry],
	)

	// Expose registry for debugging and extensibility
	const getRegistryInfo = useCallback(
		() => ({
			parsers: registry.getRegisteredParsers(),
			classifiers: registry.getRegisteredClassifiers(),
		}),
		[registry],
	)

	return {
		classifyMessage,
		getRegistryInfo,
	}
}
