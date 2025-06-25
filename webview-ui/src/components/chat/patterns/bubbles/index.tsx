/**
 * Bubble Components - Inheritance-Style Component System
 *
 * This module exports specialized bubble components that follow an
 * object-oriented inheritance pattern using React composition.
 *
 * INHERITANCE HIERARCHY:
 * BubbleUnified (Base class with all styling logic)
 *   ↓
 * BaseBubble (Abstract base for inheritance)
 *   ↓
 * Specialized Bubbles (ThinkingBubble, ErrorBubble, etc.)
 *   ↓
 * Advanced Bubbles (User-created extensions)
 *
 * COMPONENT OVERRIDING:
 * Each level can override:
 * - headerComponent: Custom header rendering
 * - contentComponent: Custom content rendering
 * - styleOverrides: Custom styling
 * - Any other props
 *
 * USAGE EXAMPLES:
 *
 * Basic usage:
 * <ThinkingBubble message={message} />
 *
 * Override styling:
 * <ThinkingBubble
 *   message={message}
 *   styleOverrides={{ border: '3px solid gold' }}
 * />
 *
 * Override content:
 * <ThinkingBubble
 *   message={message}
 *   contentComponent={CustomThinkingContent}
 * />
 *
 * Create advanced inheritance:
 * export const AdvancedThinkingBubble = (props) => (
 *   <ThinkingBubble
 *     {...props}
 *     contentComponent={AdvancedThinkingContent}
 *     styleOverrides={{ background: 'linear-gradient(...)' }}
 *   />
 * )
 */

// Base components
export { BubbleUnified } from "../BubbleUnified"

// Shared components for building bubbles
export {
	BubbleHeader,
	BubbleContentWrapper,
	ExpandableBubbleContent,
	SimpleBubbleContent,
	TimestampExpandableBubbleContent,
} from "./shared/BubbleContent"

export { createWorkClassification, createBubbleComponent, createSimpleBubble } from "./shared/BubbleHelpers"

// Standard bubble interfaces
export type {
	BaseBubbleProps,
	ExpandableBubbleProps,
	StreamingBubbleProps,
	FileBubbleProps,
	InteractiveBubbleProps,
	SimpleExpandableBubbleProps,
} from "./types"

// Core bubble components
export { UserBubble } from "./UserBubble"
export { AgentBubble } from "./AgentBubble"

// Specialized bubble components
export { ThinkingBubble } from "./ThinkingBubble"
export { ErrorBubble } from "./ErrorBubble"
export { TaskCompletedBubble } from "./TaskCompletedBubble"
export { FileReadBubble } from "./FileReadBubble"
export { FileWriteBubble } from "./FileWriteBubble"
export { FileSearchBubble } from "./FileSearchBubble"
export { ModeChangeBubble } from "./ModeChangeBubble"
export { CommandBubble } from "./CommandBubble"
export { SearchBubble } from "./SearchBubble"
export { CodebaseSearchBubble } from "./CodebaseSearchBubble"
export { ApiBubble } from "./ApiBubble"
export { BrowserBubble } from "./BrowserBubble"
export { CheckpointBubble } from "./CheckpointBubble"
export { ContextBubble } from "./ContextBubble"
export { SubtaskBubble } from "./SubtaskBubble"
export { McpBubble } from "./McpBubble"
export { CompletionBubble } from "./CompletionBubble"
export { DefaultBubble } from "./DefaultBubble"

// Re-export utility variants from BubbleUnified
export { WorkBubble, OverrideBubble } from "../BubbleUnified"
