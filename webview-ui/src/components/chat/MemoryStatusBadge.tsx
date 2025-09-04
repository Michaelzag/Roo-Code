import React, { useState, useEffect, useMemo } from "react"
import { Brain, Search, Save } from "lucide-react"

import { cn } from "@src/lib/utils"
import { vscode } from "@src/utils/vscode"
import { useAppTranslation } from "@/i18n/TranslationContext"

import type { ConversationMemoryStatusPayload, ConversationMemoryOperationPayload } from "@roo/WebviewMessage"

import { useExtensionState } from "@src/context/ExtensionStateContext"
import { StandardTooltip, Button, PopoverTrigger } from "@src/components/ui"
import { MemoryPopover } from "./MemoryPopover"

interface MemoryStatusBadgeProps {
	className?: string
}

export const MemoryStatusBadge: React.FC<MemoryStatusBadgeProps> = ({ className }) => {
	const { t } = useAppTranslation()
	const extensionState = useExtensionState()
	const conversationMemoryEnabled = extensionState.experiments?.conversationMemory || false

	const [memoryStatus, setMemoryStatus] = useState<ConversationMemoryStatusPayload>({
		initialized: false,
		enabled: false,
		codeIndexConfigured: false,
	})

	const [currentOperation, setCurrentOperation] = useState<ConversationMemoryOperationPayload | null>(null)
	const [operationHistory, setOperationHistory] = useState<ConversationMemoryOperationPayload[]>([])

	useEffect(() => {
		// Request initial memory status
		vscode.postMessage({ type: "conversationMemoryStatus" })

		// Set up message listener for status updates
		const handleMessage = (event: MessageEvent) => {
			const message = event.data
			if (message.type === "conversationMemoryStatus") {
				setMemoryStatus(message.payload as ConversationMemoryStatusPayload)
			} else if (message.type === "conversationMemoryOperation") {
				const operation = message.payload as ConversationMemoryOperationPayload

				if (operation.status === "started") {
					setCurrentOperation(operation)
				} else {
					setCurrentOperation(null)
					// Add to history
					setOperationHistory((prev) => [...prev.slice(-9), operation])

					// Clear from history after 5 seconds
					setTimeout(() => {
						setOperationHistory((prev) => prev.filter((op) => op !== operation))
					}, 5000)
				}
			}
		}

		window.addEventListener("message", handleMessage)

		return () => {
			window.removeEventListener("message", handleMessage)
		}
	}, [])

	const tooltipText = useMemo(() => {
		if (currentOperation) {
			const opName = t(`chat:memoryOperation.${currentOperation.operation}`) || currentOperation.operation
			return `${opName}: ${currentOperation.message || t("chat:memoryOperation.inProgress")}`
		}

		if (!memoryStatus.enabled) {
			return t("chat:memoryStatus.disabled")
		}

		if (!memoryStatus.codeIndexConfigured) {
			return t("chat:memoryStatus.codeIndexNotConfigured")
		}

		if (!memoryStatus.initialized) {
			return t("chat:memoryStatus.notInitialized")
		}

		return t("chat:memoryStatus.ready")
	}, [memoryStatus, currentOperation, t])

	const statusColorClass = useMemo(() => {
		if (currentOperation) {
			return currentOperation.status === "failed" ? "bg-red-500" : "bg-yellow-500 animate-pulse"
		}

		// Check for recent failed operations in history
		const recentFailedOperation = operationHistory.find((op) => op.status === "failed")
		if (recentFailedOperation) {
			return "bg-red-500"
		}

		if (!memoryStatus.enabled || !memoryStatus.codeIndexConfigured) {
			return "bg-vscode-descriptionForeground/40"
		}

		if (!memoryStatus.initialized) {
			return "bg-yellow-500"
		}

		return "bg-green-500"
	}, [memoryStatus, currentOperation, operationHistory])

	// Don't show if memory is not configured to be enabled
	if (!conversationMemoryEnabled) {
		return null
	}

	const getOperationIcon = (operation: string) => {
		switch (operation) {
			case "search":
				return <Search className="w-3 h-3" />
			case "store":
				return <Save className="w-3 h-3" />
			case "extract":
				return <Brain className="w-3 h-3" />
			case "sync":
				return <Brain className="w-3 h-3" />
			default:
				return <Brain className="w-3 h-3" />
		}
	}

	const showBadge = memoryStatus.enabled || currentOperation || operationHistory.length > 0

	if (!showBadge) {
		return null
	}

	return (
		<MemoryPopover memoryStatus={memoryStatus}>
			<div className="relative">
				<StandardTooltip content={tooltipText}>
					<PopoverTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							aria-label={tooltipText}
							className={cn(
								"relative h-7 w-7 p-0",
								"text-vscode-foreground opacity-85",
								"hover:opacity-100 hover:bg-[rgba(255,255,255,0.03)]",
								"focus:outline-none focus-visible:ring-1 focus-visible:ring-vscode-focusBorder",
								className,
							)}>
							{currentOperation ? (
								getOperationIcon(currentOperation.operation)
							) : (
								<Brain className="w-4 h-4" />
							)}
							<span
								className={cn(
									"absolute top-1 right-1 w-1.5 h-1.5 rounded-full transition-colors duration-200",
									statusColorClass,
								)}
							/>
						</Button>
					</PopoverTrigger>
				</StandardTooltip>

				{/* Operation History Toast-like notifications removed to prevent intrusive popups */}
				{/* Icon state changes are preserved through statusColorClass logic */}
			</div>
		</MemoryPopover>
	)
}
