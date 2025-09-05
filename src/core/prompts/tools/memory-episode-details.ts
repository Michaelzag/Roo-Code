import { ToolArgs } from "./types"

export function getMemoryEpisodeDetailsDescription(_args: ToolArgs): string {
	return `## memory_episode_details

Use this to expand details for a specific episode after memory_search returns an episode ID. Use sparingly and only when necessary to proceed.

<memory_episode_details>
<episode_id>ep_...</episode_id>
<limit>5 (optional)</limit>
</memory_episode_details>`
}
