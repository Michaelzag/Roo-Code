import React from "react"
import { cn } from "@src/lib/utils"
import type { ClineMessage } from "@roo-code/types"

interface StatusBarProps {
	message: ClineMessage
	className?: string
}

export const StatusBar: React.FC<StatusBarProps> = ({ message, className }) => {
	// Don't render empty status messages
	if (!message.text || message.text.trim() === "") {
		return null
	}

	return (
		<div className={cn("bg-opacity-5 px-2 py-1 my-1 rounded text-sm", className)}>
			<div className="text-vscode-foreground opacity-70">{message.text}</div>
		</div>
	)
}
