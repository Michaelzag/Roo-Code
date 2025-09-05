import { ToolArgs } from "./types"

export function getMemorySearchDescription(_args: ToolArgs): string {
	return `## memory_search

Use this to recall prior decisions, patterns, and debugging context from the current workspace.

<memory_search>
<query>Natural language query</query>
</memory_search>`
}
