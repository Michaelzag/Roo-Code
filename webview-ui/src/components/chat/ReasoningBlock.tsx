import { useCallback, useEffect, useRef, useState } from "react"
import { CaretDownIcon, CaretUpIcon, CounterClockwiseClockIcon } from "@radix-ui/react-icons"
import { useTranslation } from "react-i18next"

import MarkdownBlock from "../common/MarkdownBlock"
import { useMount } from "react-use"

interface ReasoningBlockProps {
	content: string
	elapsed?: number
	isCollapsed?: boolean
	onToggleCollapse?: () => void
}

export const ReasoningBlock = ({ content, elapsed, isCollapsed = false, onToggleCollapse }: ReasoningBlockProps) => {
	const contentRef = useRef<HTMLDivElement>(null)
	const elapsedRef = useRef<number>(0)
	const { t } = useTranslation("chat")
	const [thought, setThought] = useState<string>()
	const [prevThought, setPrevThought] = useState<string>(t("chat:reasoning.thinking"))
	const [isTransitioning, setIsTransitioning] = useState<boolean>(false)
	const cursorRef = useRef<number>(0)
	const queueRef = useRef<string[]>([])

	useEffect(() => {
		if (contentRef.current && !isCollapsed) {
			contentRef.current.scrollTop = contentRef.current.scrollHeight
		}
	}, [content, isCollapsed])

	useEffect(() => {
		if (elapsed) {
			elapsedRef.current = elapsed
		}
	}, [elapsed])

	// Process the transition queue.
	const processNextTransition = useCallback(() => {
		const nextThought = queueRef.current.pop()
		queueRef.current = []

		if (nextThought) {
			setIsTransitioning(true)
		}

		setTimeout(() => {
			if (nextThought) {
				setPrevThought(nextThought)
				setIsTransitioning(false)
			}

			setTimeout(() => processNextTransition(), 500)
		}, 200)
	}, [])

	useMount(() => {
		processNextTransition()
	})

	useEffect(() => {
		if (content.length - cursorRef.current > 160) {
			setThought("... " + content.slice(cursorRef.current))
			cursorRef.current = content.length
		}
	}, [content])

	useEffect(() => {
		if (thought && thought !== prevThought) {
			queueRef.current.push(thought)
		}
	}, [thought, prevThought])

	return (
		<div
			style={{
				borderLeft: "3px solid color-mix(in srgb, var(--vscode-terminal-ansiMagenta) 60%, transparent)",
				background: "color-mix(in srgb, var(--vscode-terminal-ansiMagenta) 4%, transparent)",
				padding: "8px 12px",
				margin: "6px 0",
				borderRadius: "2px",
			}}>
			<div className="flex items-center justify-between gap-2 cursor-pointer" onClick={onToggleCollapse}>
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<span
						className="codicon codicon-lightbulb"
						style={{
							color: "var(--vscode-terminal-ansiMagenta)",
							fontSize: 14,
						}}
					/>
					<div
						className={`truncate transition-opacity duration-200 ${isTransitioning ? "opacity-0" : "opacity-100"}`}
						style={{
							color: "var(--vscode-foreground)",
							fontSize: "13px",
						}}>
						{prevThought}
					</div>
				</div>
				<div className="flex flex-row items-center gap-2 flex-shrink-0">
					{elapsedRef.current > 1000 && (
						<div
							className="flex items-center gap-1"
							style={{
								color: "var(--vscode-terminal-ansiMagenta)",
								opacity: 0.8,
							}}>
							<CounterClockwiseClockIcon style={{ width: "12px", height: "12px" }} />
							<div style={{ fontSize: "11px" }}>
								{t("reasoning.seconds", { count: Math.round(elapsedRef.current / 1000) })}
							</div>
						</div>
					)}
					<div style={{ padding: "2px" }}>
						{isCollapsed ? (
							<CaretDownIcon
								style={{
									color: "var(--vscode-terminal-ansiMagenta)",
									width: "12px",
									height: "12px",
								}}
							/>
						) : (
							<CaretUpIcon
								style={{
									color: "var(--vscode-terminal-ansiMagenta)",
									width: "12px",
									height: "12px",
								}}
							/>
						)}
					</div>
				</div>
			</div>
			{!isCollapsed && (
				<div
					ref={contentRef}
					style={{
						padding: "6px 0 4px 20px",
						maxHeight: "120px",
						overflowY: "auto",
						fontSize: "13px",
					}}>
					<MarkdownBlock markdown={content} />
				</div>
			)}
		</div>
	)
}
