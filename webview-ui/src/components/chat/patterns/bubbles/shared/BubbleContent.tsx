// Re-export base components (foundation layer)
export { BaseContainer } from "./base/BaseContainer"
export { BaseHeader } from "./base/BaseHeader"
export { BaseContent } from "./base/BaseContent"

// Re-export layout components (content layout layer)
export { BubbleContentWrapper } from "./layouts/BubbleContentWrapper"
export { ExpandableBubbleContent } from "./layouts/ExpandableBubbleContent"
export { SimpleBubbleContent } from "./layouts/SimpleBubbleContent"
export { TimestampExpandableBubbleContent } from "./layouts/TimestampExpandableBubbleContent"

// Re-export renderer components
export { SmartContentRenderer } from "./renderers/SmartContentRenderer"
export { ListContentRenderer } from "./renderers/ListContentRenderer"

// Re-export legacy shared components (for compatibility)
export { BubbleHeader } from "./BubbleHeader"
export { BubbleFrame } from "./BubbleFrame"
