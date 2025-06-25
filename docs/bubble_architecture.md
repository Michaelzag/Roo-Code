# Bubble System Architecture

Chat bubbles provide consistent styling and semantic theming for message rendering in the Roo Code extension.

## Core Components

### BubbleUnified

Central component that all bubbles use for consistent styling and semantic theming. Handles:

- Semantic theme application via CSS custom properties
- Component composition via `headerComponent` and `contentComponent` props
- Four variants: `user`, `agent`, `work`, `override`

### Base Components

Foundation styling components with dynamic semantic theming:

- **BaseContainer** - Borders, shadows, semantic backgrounds
- **BaseHeader** - Headers with semantic gradients and expand/collapse
- **BaseContent** - Content areas with semantic backgrounds

These use inline styles for runtime color mixing with VSCode themes.

### Layout Components

Pre-built composition patterns:

- **SimpleBubbleContent** - Header + body layout
- **ExpandableBubbleContent** - Expandable content with internal state
- **TimestampExpandableBubbleContent** - Timestamp-based expansion

### Factory Function

`createBubbleComponent` generates bubbles with consistent theming:

```typescript
createBubbleComponent(semantic, color, contentLimits?)(ContentComponent)
```

## Semantic Theming

22 semantic types provide automatic color theming:

```typescript
type SemanticType =
	| "thinking"
	| "error"
	| "file-read"
	| "file-write"
	| "command"
	| "completion"
	| "search"
	| "user-input"
// ...and 14 more
```

Each semantic type defines:

- Primary/accent colors
- Header gradients mixed with VSCode background
- Border and shadow styling
- Icon colors

Theme properties are applied as CSS custom properties:

```typescript
"--semantic-primary-color": theme.primary
"--semantic-accent-color": theme.accent
"--semantic-header-gradient": theme.headerGradient
```

## Content Processing

### SmartContentRenderer

Optional utility for automatic content processing:

- Detects JSON, Markdown, plain text
- Handles structured data (file operations, search results)
- Applies content limiting with preview/expand

### Content Limiting

Optional overflow prevention:

```typescript
interface BubbleContentLimits {
	maxLines?: number // Limit text lines
	maxItems?: number // Limit list items
	collapsedByDefault?: boolean
	previewLines?: number // Preview size when collapsed
}
```

## VSCode Integration

### Color Mixing

Colors blend with VSCode editor background for native appearance:

```typescript
background: "color-mix(in srgb, #f59e0b 12%, var(--vscode-editor-background))"
```

### Tailwind Classes

VSCode-specific Tailwind classes for consistent styling:

- `text-vscode-foreground`
- `bg-vscode-input-background`
- `border-vscode-panel-border`

## Development Patterns

### Basic Bubble

```typescript
const SimpleContent = ({ message }) => (
  <div className="p-3 text-sm text-vscode-foreground">
    {message.text}
  </div>
)

export const SimpleBubble = createBubbleComponent("semantic-type", "blue")(SimpleContent)
```

### Layout Component Usage

```typescript
const StructuredContent = ({ message, classification }) => (
  <SimpleBubbleContent
    message={message}
    classification={classification}
    icon="gear"
    title="Operation"
    renderContent={() => <CustomRenderer message={message} />}
  />
)
```

### Direct Base Component Usage

```typescript
const CustomContent = ({ message, classification }) => (
  <BaseContainer classification={classification}>
    <BaseHeader icon="terminal" title="Terminal" classification={classification} />
    <BaseContent classification={classification}>
      <TerminalRenderer message={message} />
    </BaseContent>
  </BaseContainer>
)
```

## Type System

Progressive enhancement interfaces allow adding capabilities:

```typescript
BaseBubbleProps
  ↓ (adds expansion)
ExpandableBubbleProps
  ↓ (adds streaming)
StreamingBubbleProps
  ↓ (adds file operations)
FileBubbleProps
```

## Chat Integration

Bubbles integrate via semantic routing in ChatMessage.tsx:

```typescript
case "thinking":
  return <ThinkingBubble message={message} classification={style} />
case "error":
  return <ErrorBubble message={message} classification={style} />
```

## File Structure

```
bubbles/
├── shared/
│   ├── base/              # Foundation components
│   ├── layouts/           # Layout patterns
│   ├── renderers/         # Content processors
│   └── BubbleHelpers.tsx  # Factory function
├── ThinkingBubble.tsx     # Individual bubbles
├── ErrorBubble.tsx
├── types.ts               # Interfaces
└── index.tsx              # Exports
```

This architecture provides consistent foundation styling with flexibility for specialized content rendering.
