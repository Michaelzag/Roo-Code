# Typography Inheritance System

A centralized, user-scalable typography system for bubble components that replaces inconsistent hardcoded font sizes with semantic scaling.

## Overview

The Typography Inheritance System solves the critical problem of inconsistent typography across bubble components. Previously, developers used hardcoded font sizes (`fontSize: '18px'`, `text-xs font-semibold`, `chat-small-typography`) which would break when users need to scale bubble text sizes.

This system provides:

- **Centralized scaling control** - Single point to scale all bubble typography
- **Semantic awareness** - Different bubble types get appropriate relative scaling
- **Architecture integration** - Works with existing bubble factory pattern and base components
- **Developer flexibility** - Preserves specialized typography contexts while adding consistency

## Scale Values in Code

### Base Scale Configuration

**File**: [`TypographyInheritance.tsx`](../webview-ui/src/components/chat/patterns/bubbles/shared/TypographyInheritance.tsx) (Lines 53-57)

```typescript
const DEFAULT_SCALE: TypographyScale = {
	baseScale: 1.0, // 100% - User controllable base scale
	lineHeightScale: 1.0, // 100% - Line height scaling
	codeScale: 0.95, // 95% - Code elements slightly smaller
}
```

### Semantic Scale Modifiers

**File**: [`TypographyInheritance.tsx`](../webview-ui/src/components/chat/patterns/bubbles/shared/TypographyInheritance.tsx) (Lines 22-41)

```typescript
const SEMANTIC_SCALE_MODIFIERS = {
	thinking: 1.0, // 100% - Standard scale for reasoning content
	error: 0.95, // 95% - Slightly smaller for dense error info
	"file-read": 0.95, // 95% - Smaller for file lists and paths
	"file-write": 0.95, // 95% - Smaller for file operations
	"file-search": 0.95, // 95% - Smaller for search results
	"codebase-search": 0.9, // 90% - Smaller for dense search results with code
	"mode-change": 1.05, // 105% - Slightly larger for important mode changes
	command: 0.9, // 90% - Smaller for terminal output
	completion: 1.0, // 100% - Standard for user interactions
	search: 0.95, // 95% - Smaller for search results
	"user-input": 1.0, // 100% - Standard for user messages
	"agent-response": 1.0, // 100% - Standard for agent text
	browser: 0.95, // 95% - Smaller for browser interaction details
	mcp: 0.95, // 95% - Smaller for technical MCP details
	api: 0.95, // 95% - Smaller for API request/response details
	subtask: 1.0, // 100% - Standard for subtask descriptions
	context: 0.95, // 95% - Smaller for context operations
	checkpoint: 1.0, // 100% - Standard for checkpoints
}
```

### Typography Contexts

Each typography context defines specific font sizes and styling:

```typescript
export type TypographyContext =
	| "header" // Bubble headers (16px base)
	| "content" // Main content areas (14px base)
	| "badge" // Status badges, indicators (12px base)
	| "metadata" // Secondary info, timestamps (12px base)
	| "code-inline" // Inline code, file paths (12px base, monospace)
	| "code-block" // Code blocks, terminal output (12px base, monospace)
	| "emphasis" // Important callouts (14px base, weight 600)
	| "micro" // Very small text, icons (11px base)
	| "score" // Numerical scores, percentages (16px base)
```

### Scale Calculation

**File**: [`TypographyInheritance.tsx`](../webview-ui/src/components/chat/patterns/bubbles/shared/TypographyInheritance.tsx) (Lines 109-111)

```typescript
// Calculate final scale
const finalScale = scale.baseScale * semanticModifier
const codeScale = scale.codeScale * semanticModifier
const lineHeightScale = scale.lineHeightScale
```

### Font Size Application

**File**: [`TypographyInheritance.tsx`](../webview-ui/src/components/chat/patterns/bubbles/shared/TypographyInheritance.tsx) (Lines 116-187)

```typescript
case "header":
  fontSize: `${16 * finalScale}px`,     // 16px base * scale

case "content":
  fontSize: `${14 * finalScale}px`,     // 14px base * scale

case "metadata":
  fontSize: `${12 * finalScale}px`,     // 12px base * scale

case "score":
  fontSize: `${16 * finalScale}px`,     // 16px base * scale (replaces hardcoded 18px)

case "code-inline":
  fontSize: `${12 * codeScale}px`,      // 12px base * code scale
```

## Real Examples

### CodebaseSearchBubble (semantic: "codebase-search")

**Semantic modifier**: `0.9` (90%)

- **Score text**: `16px * 1.0 * 0.9 = 14.4px` (was hardcoded `18px`)
- **File paths**: `12px * 0.95 * 0.9 = 10.26px` (code-inline context)
- **Headers**: `16px * 1.0 * 0.9 = 14.4px`
- **Metadata**: `12px * 1.0 * 0.9 = 10.8px`

### ThinkingBubble (semantic: "thinking")

**Semantic modifier**: `1.0` (100%)

- **Badge text**: `12px * 1.0 * 1.0 = 12px` (badge context)
- **Content**: `14px * 1.0 * 1.0 = 14px` (content context)
- **Headers**: `16px * 1.0 * 1.0 = 16px`

### User Scaling Examples

If user sets `baseScale: 1.2` (120%):

**CodebaseSearchBubble**:

- Score text: `16px * 1.2 * 0.9 = 17.28px`
- File paths: `12px * 1.14 * 0.9 = 12.31px` (codeScale: 0.95 \* 1.2 = 1.14)

**ThinkingBubble**:

- Badge text: `12px * 1.2 * 1.0 = 14.4px`
- Content: `14px * 1.2 * 1.0 = 16.8px`

## Component Usage

### ScaledText Component

```typescript
import { ScaledText } from "./shared/TypographyInheritance"

// Basic usage
<ScaledText context="metadata">Usage info</ScaledText>

// With weight and styling
<ScaledText context="emphasis" weight="semibold" className="text-red-400">
  Error occurred
</ScaledText>
```

### Pre-configured Components

```typescript
import { ScaledBadge, ScaledCode, ScaledScore, ScaledIcon } from "./shared/TypographyInheritance"

// Badge with semantic styling
<ScaledBadge variant="error">File Protected</ScaledBadge>

// Code with automatic monospace
<ScaledCode inline>{filePath}</ScaledCode>

// Numerical scores (replaces hardcoded fontSize)
<ScaledScore>85%</ScaledScore>

// Icons with proper scaling
<ScaledIcon className="codicon codicon-file" />
```

## Architecture Integration

### Factory Pattern Integration

**File**: [`BubbleHelpers.tsx`](../webview-ui/src/components/chat/patterns/bubbles/shared/BubbleHelpers.tsx)

Every bubble created with `createBubbleComponent` automatically gets typography scaling:

```typescript
return (
  <TypographyProvider semantic={semantic}>
    <BubbleUnified /* ... */ />
  </TypographyProvider>
)
```

### Base Component Integration

**Files**:

- [`BaseHeader.tsx`](../webview-ui/src/components/chat/patterns/bubbles/shared/base/BaseHeader.tsx)
- [`BaseContent.tsx`](../webview-ui/src/components/chat/patterns/bubbles/shared/base/BaseContent.tsx)

Base components use scaling automatically:

```typescript
const { style: headerTypography } = useBaseTypography("header")

// Apply scaled typography
<span style={headerTypography}>{title}</span>
```

## Migration Status

### ✅ Migrated Bubbles

1. **ApiBubble** - `<ScaledText context="metadata">` for usage info
2. **ThinkingBubble** - `<ScaledBadge>` for reasoning process badge
3. **CommandBubble** - `<ScaledText context="code-inline">` for terminal headers
4. **ErrorBubble** - `<ScaledBadge variant="error">` and `<ScaledCode>`
5. **CodebaseSearchBubble** - `<ScaledScore>` (replaces hardcoded 18px), `<ScaledIcon>`, `<ScaledText context="code-inline">`
6. **McpBubble** - `<ScaledText context="emphasis">` and `<ScaledIcon>`

### 🔄 Remaining Bubbles to Migrate

- BrowserBubble
- CheckpointBubble
- FileReadBubble
- FileSearchBubble
- FileWriteBubble
- SubtaskBubble
- UserBubble
- AgentBubble
- DefaultBubble
- ModeChangeBubble
- TaskCompletedBubble

## Future User Control

The system is designed to eventually connect to user preferences:

```typescript
// Future user settings integration
<TypographyProvider
  semantic={semantic}
  userScale={{
    baseScale: userPreferences.bubbleScale,      // 0.8, 1.0, 1.2, 1.5
    lineHeightScale: userPreferences.lineHeight, // 0.9, 1.0, 1.1
    codeScale: userPreferences.codeScale         // 0.85, 0.95, 1.0
  }}
>
```

This would allow users to scale all bubble typography from a single control while maintaining the semantic relationships between different bubble types.

## Benefits

1. **User Scalability** - Single control point for all bubble typography
2. **Semantic Awareness** - Dense bubbles (search results) stay relatively smaller than important bubbles (mode changes)
3. **Developer Preservation** - Maintains all existing fine-tuning decisions in a scalable way
4. **Architecture Compliance** - Integrates seamlessly with existing bubble system
5. **Progressive Enhancement** - Unmigrated bubbles continue working while migrated ones scale better

## Next Steps

1. **Continue migration** - Convert remaining bubbles to use scaled components
2. **User preferences integration** - Connect baseScale to user settings
3. **Testing** - Verify scaling works properly across all semantic types
4. **Documentation** - Update bubble README with typography migration guidelines
