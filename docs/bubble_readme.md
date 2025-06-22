# Chat Bubble System Guide

The Roo Code chat interface uses a sophisticated factory-based bubble system that ensures consistent styling and behavior while making it easy to add new features with minimal boilerplate. The system intelligently parses raw messages into structured data and routes them to appropriate bubble components automatically.

## System Architecture

### BubbleUnified Foundation

All chat bubbles are built on [`BubbleUnified`](../webview-ui/src/components/chat/patterns/BubbleUnified.tsx), which provides:

- ✅ Consistent styling and theming with semantic color coordination
- ✅ Hover states and animations with VSCode integration
- ✅ Advanced expansion/collapse behavior
- ✅ Component overriding for custom content rendering
- ✅ Semantic CSS custom properties for enhanced theming

### Factory Pattern Architecture

The system uses a dual factory pattern that automatically handles:

- ✅ **Message Parsing**: Structured data extraction from raw messages
- ✅ **Semantic Classification**: Intelligent routing to appropriate bubble types
- ✅ **BubbleUnified Integration**: Consistent styling and prop passing
- ✅ **Type Safety**: Full TypeScript support with structured data models
- ✅ **Extensibility**: Easy addition of new message types without code changes

### Shared Content Components

Reusable content components eliminate duplication:

- ✅ [`SimpleBubbleContent`](../webview-ui/src/components/chat/patterns/bubbles/shared/BubbleContent.tsx) - Standard header + body layout
- ✅ [`TimestampExpandableBubbleContent`](../webview-ui/src/components/chat/patterns/bubbles/shared/BubbleContent.tsx) - Expandable with timestamp handling
- ✅ [`BubbleHeader`](../webview-ui/src/components/chat/patterns/bubbles/shared/BubbleContent.tsx) - Consistent headers with semantic styling

## The Primary Pattern: Factory-Based Bubbles

Most bubbles follow this streamlined factory pattern:

```typescript
// YourBubble.tsx
import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

// Content component - uses shared components
const YourContent: React.FC<{
  message: ClineMessage
  classification: MessageStyle
}> = ({ message }) => {
  return (
    <SimpleBubbleContent
      message={message}
      classification={{} as MessageStyle} // Auto-set by factory
      icon="your-icon"
      title="Your Operation"
      renderContent={(msg) => (
        <div className="text-sm text-vscode-foreground">
          {/* Custom content using ONLY Tailwind classes */}
          {msg.text}
        </div>
      )}
    />
  )
}

// Bubble component - created by factory
export const YourBubble = createBubbleComponent<{
  // Add any additional props here
}>('your-semantic-type', 'blue')(YourContent)
```

## Adding New Chat Features

### Method 1: Factory Pattern (Recommended)

#### Step 1: Create Your Bubble Component

Create `webview-ui/src/components/chat/patterns/bubbles/YourBubble.tsx`:

```typescript
import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { SimpleBubbleContent } from "./shared/BubbleContent"
import { createBubbleComponent } from "./shared/BubbleHelpers"

// Content component using shared components
const YourContent: React.FC<{
  message: ClineMessage
  classification: MessageStyle
}> = ({ message }) => {
  return (
    <SimpleBubbleContent
      message={message}
      classification={{} as MessageStyle} // Set by factory
      icon="your-icon"
      title="Your Operation Title"
      renderContent={(msg) => (
        <div className="text-sm text-vscode-foreground">
          {msg.text}
        </div>
      )}
    />
  )
}

// Bubble component created by factory
export const YourBubble = createBubbleComponent('your-semantic', 'blue')(YourContent)
```

#### Step 2: Add Message Classification

For new message types, create classification factories in [`webview-ui/src/components/chat/classification/factories/`](../webview-ui/src/components/chat/classification/factories/):

1. **Create a Parser** (if needed) to handle your message structure
2. **Create a Classifier** to route to your semantic type
3. **Register both** in [`useFactoryMessageClassification.tsx`](../webview-ui/src/components/chat/classification/useFactoryMessageClassification.tsx)

Most new features work automatically with the existing comprehensive factory system.

#### Step 3: Add Routing

In `webview-ui/src/components/chat/ChatMessage.tsx`:

```typescript
case 'your-semantic':
  return <YourBubble
    message={message}
    classification={style}
    {...bubbleProps}
  />
```

#### Step 4: Export Your Component

In [`webview-ui/src/components/chat/patterns/bubbles/index.tsx`](../webview-ui/src/components/chat/patterns/bubbles/index.tsx):

```typescript
export { YourBubble } from "./YourBubble"
```

### Method 2: Advanced Custom Bubble

For complex bubbles requiring custom logic, use direct BubbleUnified integration:

```typescript
import React from "react"
import type { ClineMessage } from "@roo-code/types"
import type { MessageStyle } from "../../theme/chatDefaults"
import { BubbleUnified } from "../BubbleUnified"
import { createWorkClassification } from "./shared/BubbleHelpers"

const CustomContent: React.FC<{
  message: ClineMessage
  classification: MessageStyle
  customProp?: string
}> = ({ message, customProp }) => {
  // Complex custom logic here
  return (
    <div className="p-4">
      <div className="text-sm text-vscode-foreground">
        {message.text} - {customProp}
      </div>
    </div>
  )
}

export const CustomBubble: React.FC<{
  message: ClineMessage
  classification?: MessageStyle
  customProp?: string
}> = ({ message, classification, customProp }) => {
  const bubbleClassification = createWorkClassification('your-semantic', 'blue', classification)

  return (
    <BubbleUnified
      message={message}
      classification={bubbleClassification}
      contentComponent={CustomContent}
      contentProps={{ customProp }}
    />
  )
}
```

## Shared Content Components

The system provides reusable content components to eliminate duplication:

### SimpleBubbleContent

For standard header + body layout:

```typescript
import { SimpleBubbleContent } from "./shared/BubbleContent"

<SimpleBubbleContent
  message={message}
  classification={classification}
  icon="info"
  title="Operation Title"
  renderContent={(msg) => (
    <div className="text-sm text-vscode-foreground">
      {msg.text}
    </div>
  )}
/>
```

### TimestampExpandableBubbleContent

For expandable operations that use message timestamps:

```typescript
import { TimestampExpandableBubbleContent } from "./shared/BubbleContent"

<TimestampExpandableBubbleContent
  message={message}
  classification={classification}
  icon="terminal"
  title="Command"
  isExpanded={isExpanded}
  onToggleExpand={onToggleExpand}
/>
```

### ExpandableBubbleContent

For simple expandable content with internal state:

```typescript
import { ExpandableBubbleContent } from "./shared/BubbleContent"

<ExpandableBubbleContent
  message={message}
  classification={classification}
  icon="file"
  title="File Content"
  expanded={expanded}
  onToggleExpand={onToggleExpand}
/>
```

## Content Component Rules

### ✅ DO

- Use **ONLY** Tailwind classes: `className="p-4 text-sm"`
- Use VSCode Tailwind classes: `text-vscode-foreground`, `bg-vscode-input-background`
- Leverage shared content components when possible
- Use factory pattern for consistent bubble creation
- Keep content focused on data presentation

### ❌ DON'T

- Use inline styles: `style={{ fontSize: "14px" }}`
- Use hardcoded VSCode variables: `color: "var(--vscode-foreground)"`
- Duplicate header/content patterns manually
- Skip the factory pattern for standard bubbles

## Tailwind Classes for VSCode

Use these VSCode-specific Tailwind classes:

```typescript
// Colors
className = "text-vscode-foreground"
className = "text-vscode-descriptionForeground"
className = "bg-vscode-input-background"
className = "border-vscode-panel-border"

// Interactive
className = "hover:bg-vscode-input-background/70"
className = "focus:ring-vscode-focusBorder/50"
```

## Example: Working Factory Pattern

From [`CompletionBubble.tsx`](../webview-ui/src/components/chat/patterns/bubbles/CompletionBubble.tsx):

```typescript
const CompletionContent: React.FC<{
  message: ClineMessage
  classification: MessageStyle
  onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}> = ({ message, onSuggestionClick }) => {
  const { t } = useTranslation()

  const followUpData = safeJsonParse<any>(message.text)
  const question = followUpData?.question || message.text
  const suggestions = followUpData?.suggest || []

  const renderCustomContent = () => (
    <>
      <div className="text-sm text-vscode-foreground leading-relaxed mb-4">
        <Markdown markdown={question} />
      </div>
      {suggestions.length > 0 && (
        <div className="space-y-2">
          {suggestions.map((suggestion: string, index: number) => (
            <button
              key={index}
              onClick={(e) => onSuggestionClick?.(suggestion, e)}
              className="w-full text-left p-3 rounded border border-vscode-panel-border
                        bg-vscode-input-background/50 text-sm text-vscode-foreground
                        hover:bg-vscode-input-background/70 hover:border-vscode-focusBorder/50"
            >
              <span className="codicon codicon-circle-small mr-2" />
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </>
  )

  return (
    <SimpleBubbleContent
      message={message}
      classification={{} as MessageStyle}
      icon="info"
      title={t("chat:questions.hasQuestion")}
      renderContent={renderCustomContent}
    />
  )
}

export const CompletionBubble = createBubbleComponent<{
  onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}>('completion', 'green')(CompletionContent)
```

## Example: Simple Factory Usage

From [`UserBubble.tsx`](../webview-ui/src/components/chat/patterns/bubbles/UserBubble.tsx):

```typescript
const UserContent: React.FC<{
  message: ClineMessage
  classification: MessageStyle
}> = ({ message }) => {
  return (
    <div className="p-3">
      {message.text}
    </div>
  )
}

export const UserBubble = createBubbleComponent('user-input', 'blue')(UserContent)
```

## Component Architecture

### Factory Functions

[`createBubbleComponent`](../webview-ui/src/components/chat/patterns/bubbles/shared/BubbleHelpers.tsx) - Main factory for creating bubbles:

```typescript
export const YourBubble = createBubbleComponent<{
	customProp?: string
}>(
	"semantic-type",
	"default-color",
)(ContentComponent)
```

[`createWorkClassification`](../webview-ui/src/components/chat/patterns/bubbles/shared/BubbleHelpers.tsx) - Helper for manual classification:

```typescript
const classification = createWorkClassification("semantic-type", "blue", existingClassification)
```

[`createSimpleBubble`](../webview-ui/src/components/chat/patterns/bubbles/shared/BubbleHelpers.tsx) - Quick factory for basic bubbles:

```typescript
export const SimpleBubble = createSimpleBubble("semantic-type", "icon-name", "Title", "blue")
```

### Type Definitions

Standard interfaces in [`types.ts`](../webview-ui/src/components/chat/patterns/bubbles/types.ts):

```typescript
interface BaseBubbleProps {
	message: ClineMessage
	classification?: MessageStyle
	children?: React.ReactNode
	className?: string
}

interface ExpandableBubbleProps extends BaseBubbleProps {
	isExpanded?: boolean
	onToggleExpand?: (ts: number) => void
}

interface InteractiveBubbleProps extends BaseBubbleProps {
	onSuggestionClick?: (answer: string, event?: React.MouseEvent) => void
}
```

## Component Overrides

For completely custom rendering (bypassing bubble system):

```typescript
// In ChatMessage.tsx component-override section
case "your-override":
  return <YourCustomComponent message={message} {...props} />
```

## File Structure

```
webview-ui/src/components/chat/
├── patterns/
│   ├── BubbleUnified.tsx           # Foundation component
│   └── bubbles/
│       ├── shared/
│       │   ├── BubbleContent.tsx   # Shared content components
│       │   ├── BubbleHelpers.tsx   # Factory functions
│       │   └── SemanticStyles.css  # Semantic styling
│       ├── index.tsx               # All exports
│       ├── types.ts                # TypeScript interfaces
│       └── YourBubble.tsx          # Individual bubble components
├── classification/
│   ├── factories/
│   │   ├── parsers/               # Message parsing factories
│   │   ├── classifiers/           # Classification factories
│   │   ├── types.ts               # Factory type definitions
│   │   ├── FactoryRegistry.ts     # Factory management
│   │   └── index.ts               # Factory exports
│   └── useFactoryMessageClassification.tsx # Factory-based classification
├── theme/
│   └── chatDefaults.ts             # Color and semantic themes
└── ChatMessage.tsx                 # Message routing
```

## Benefits of This System

✅ **Consistent Styling**: All bubbles automatically inherit proper theming, spacing, and VSCode integration
✅ **Reduced Boilerplate**: Factory pattern eliminates repetitive BubbleUnified setup
✅ **Shared Components**: Reusable header, content, and expansion patterns
✅ **Type Safety**: Full TypeScript support with proper interface inheritance
✅ **Semantic Classification**: Automatic color coordination based on operation type
✅ **Maintainable**: Changes to shared components affect all bubbles uniformly

This architecture ensures every chat feature gets beautiful, consistent styling automatically while providing a superior developer experience with minimal code duplication.
