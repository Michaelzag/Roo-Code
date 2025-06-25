# Chat Bubble System

Chat bubbles provide consistent styling and semantic theming for all message types in the Roo Code extension.

## Creating a Bubble

### Basic Pattern

```typescript
import { createBubbleComponent } from "./shared/BubbleHelpers"

const YourContent = ({ message, classification }) => (
  <div className="p-3 text-sm text-vscode-foreground">
    {message.text}
  </div>
)

export const YourBubble = createBubbleComponent("semantic-type", "blue")(YourContent)
```

### With Content Limits

```typescript
export const YourBubble = createBubbleComponent("semantic-type", "blue", { maxLines: 30, previewLines: 5 })(YourContent)
```

## Foundation Components

### BubbleUnified

All bubbles use [`BubbleUnified`](../webview-ui/src/components/chat/patterns/BubbleUnified.tsx) for consistent styling and semantic theming.

### Base Components

- [`BaseContainer`](../webview-ui/src/components/chat/patterns/bubbles/shared/base/BaseContainer.tsx) - Borders, shadows, backgrounds
- [`BaseHeader`](../webview-ui/src/components/chat/patterns/bubbles/shared/base/BaseHeader.tsx) - Headers with semantic gradients
- [`BaseContent`](../webview-ui/src/components/chat/patterns/bubbles/shared/base/BaseContent.tsx) - Content areas with semantic styling

### Layout Components

- [`SimpleBubbleContent`](../webview-ui/src/components/chat/patterns/bubbles/shared/layouts/SimpleBubbleContent.tsx) - Header + body layout
- [`ExpandableBubbleContent`](../webview-ui/src/components/chat/patterns/bubbles/shared/layouts/ExpandableBubbleContent.tsx) - Expandable content
- [`TimestampExpandableBubbleContent`](../webview-ui/src/components/chat/patterns/bubbles/shared/layouts/TimestampExpandableBubbleContent.tsx) - Timestamp-based expansion

## Semantic Theming

Each bubble specifies a semantic type for automatic color theming:

```typescript
createBubbleComponent("thinking", "yellow") // Yellow theme
createBubbleComponent("error", "red") // Red theme
createBubbleComponent("command", "gray") // Gray theme
```

Available semantic types: `thinking`, `error`, `file-read`, `file-write`, `command`, `completion`, `search`, `user-input`, `agent-response`, `browser`, `mcp`, `api`, `subtask`, `context`, `checkpoint`.

## Content Limiting

Optional content limits prevent UI overflow:

```typescript
interface BubbleContentLimits {
	maxLines?: number // Limit text lines
	maxItems?: number // Limit list items
	collapsedByDefault?: boolean
	previewLines?: number // Lines shown when collapsed
}
```

## Common Patterns

### Custom Content Rendering

```typescript
const CustomContent = ({ message, classification }) => (
  <SimpleBubbleContent
    message={message}
    classification={classification}
    icon="gear"
    title="Custom Operation"
    renderContent={() => (
      <div className="space-y-2">
        <div className="text-sm text-vscode-foreground">{message.text}</div>
        <button className="px-3 py-1 rounded bg-vscode-button-background text-vscode-button-foreground">
          Action
        </button>
      </div>
    )}
  />
)
```

### Direct Base Component Usage

```typescript
const DirectContent = ({ message, classification }) => (
  <BaseContainer classification={classification}>
    <BaseHeader icon="terminal" title="Terminal" classification={classification} />
    <BaseContent classification={classification}>
      {/* Custom terminal rendering */}
      <TerminalRenderer message={message} />
    </BaseContent>
  </BaseContainer>
)
```

### Interactive Elements

```typescript
const InteractiveContent = ({ message, onSuggestionClick }) => {
  const data = JSON.parse(message.text)

  return (
    <SimpleBubbleContent
      message={message}
      classification={classification}
      icon="question"
      title="Question"
      renderContent={() => (
        <div className="space-y-3">
          <div className="text-sm text-vscode-foreground">{data.question}</div>
          {data.suggestions?.map((suggestion, i) => (
            <button
              key={i}
              onClick={() => onSuggestionClick(suggestion)}
              className="w-full text-left p-2 rounded border border-vscode-panel-border
                         bg-vscode-input-background hover:bg-vscode-input-background/70">
              {suggestion}
            </button>
          ))}
        </div>
      )}
    />
  )
}
```

## Utility Components

### SmartContentRenderer

Optional component for automatic content processing:

```typescript
import { SmartContentRenderer } from "./shared/renderers/SmartContentRenderer"

<SmartContentRenderer
  message={message}
  semantic="thinking"
  contentLimits={{ maxLines: 20 }}
/>
```

Handles JSON, Markdown, and plain text with content limiting.

### Markdown Component

For markdown content:

```typescript
import { Markdown } from "../../Markdown"

<Markdown markdown={message.text} partial={message.partial} />
```

## Styling Rules

### Required

- Use VSCode Tailwind classes: `text-vscode-foreground`, `bg-vscode-input-background`
- Apply semantic theming via bubble classification
- Use consistent spacing and typography

### Forbidden

- Inline styles (except in base components)
- Hardcoded colors
- Custom CSS classes for content

## Adding to Chat System

1. Export from [`index.tsx`](../webview-ui/src/components/chat/patterns/bubbles/index.tsx):

```typescript
export { YourBubble } from "./YourBubble"
```

2. Add routing in [`ChatMessage.tsx`](../webview-ui/src/components/chat/ChatMessage.tsx):

```typescript
case "your-semantic-type":
  return <YourBubble message={message} classification={style} />
```

3. Configure semantic type in [`chatDefaults.ts`](../webview-ui/src/components/chat/theme/chatDefaults.ts) if new.

## File Structure

```
bubbles/
├── shared/
│   ├── base/           # Foundation components
│   ├── layouts/        # Layout patterns
│   ├── renderers/      # Content processors
│   └── BubbleHelpers.tsx
├── YourBubble.tsx      # Individual bubbles
├── types.ts
└── index.tsx
```
