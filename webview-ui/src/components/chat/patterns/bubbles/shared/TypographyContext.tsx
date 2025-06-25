/**
 * Typography Context System for Bubble Components
 *
 * Provides semantic typography helpers for specialized UI contexts
 * while maintaining consistency with the base typography system.
 *
 * Base typography (chat-content-typography, chat-header-typography)
 * continues to work for main content areas, but this system provides
 * consistent patterns for specialized elements.
 */

import React from "react"
import { cn } from "../../../../../lib/utils"

/**
 * Typography contexts for specialized UI elements
 */
export type TypographyContext =
	| "content" // Main content text (uses chat-content-typography)
	| "header" // Headers (uses chat-subheader-typography)
	| "badge" // Status badges, small indicators
	| "metadata" // Secondary info, timestamps, usage stats
	| "code" // Code blocks, file paths, terminal output
	| "micro" // Very small text, icons, micro-interactions
	| "emphasis" // Important callouts, warnings

/**
 * Typography helper that provides consistent classes for each context
 */
export const getTypographyClasses = (
	context: TypographyContext,
	options?: {
		mono?: boolean
		weight?: "normal" | "medium" | "semibold" | "bold"
		truncate?: boolean
	},
) => {
	const { mono = false, weight, truncate = false } = options || {}

	const baseClasses = {
		content: "chat-content-typography",
		header: "chat-subheader-typography",
		badge: "text-xs font-medium leading-tight",
		metadata: "chat-small-typography",
		code: "text-xs font-mono leading-relaxed",
		micro: "text-xs leading-none",
		emphasis: "text-sm font-semibold leading-snug",
	}

	const classes = [baseClasses[context]]

	// Add monospace for appropriate contexts
	if (mono && !["code"].includes(context)) {
		classes.push("font-mono")
	}

	// Add weight override if specified
	if (weight) {
		const weightMap = {
			normal: "font-normal",
			medium: "font-medium",
			semibold: "font-semibold",
			bold: "font-bold",
		}
		classes.push(weightMap[weight])
	}

	// Add truncation if needed
	if (truncate) {
		classes.push("truncate")
	}

	return cn(...classes)
}

/**
 * Typography component for consistent specialized text rendering
 */
export const TypographyText: React.FC<{
	context: TypographyContext
	children: React.ReactNode
	className?: string
	mono?: boolean
	weight?: "normal" | "medium" | "semibold" | "bold"
	truncate?: boolean
	as?: keyof JSX.IntrinsicElements
}> = ({ context, children, className = "", mono, weight, truncate, as: Component = "span" }) => {
	return (
		<Component className={cn(getTypographyClasses(context, { mono, weight, truncate }), className)}>
			{children}
		</Component>
	)
}

/**
 * Pre-configured typography components for common patterns
 */
export const Badge: React.FC<{
	children: React.ReactNode
	className?: string
	variant?: "default" | "success" | "warning" | "error"
}> = ({ children, className = "", variant = "default" }) => {
	const variantClasses = {
		default: "bg-vscode-badge-background text-vscode-badge-foreground",
		success: "bg-green-500/20 text-green-400 border-green-500/30",
		warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
		error: "bg-red-500/20 text-red-400 border-red-500/30",
	}

	return (
		<TypographyText
			context="badge"
			className={cn("px-2 py-1 rounded-md border", variantClasses[variant], className)}>
			{children}
		</TypographyText>
	)
}

export const CodeText: React.FC<{
	children: React.ReactNode
	className?: string
	inline?: boolean
}> = ({ children, className = "", inline = false }) => {
	if (inline) {
		return (
			<TypographyText
				context="code"
				className={cn("px-1 py-0.5 rounded bg-vscode-textCodeBlock-background", className)}>
				{children}
			</TypographyText>
		)
	}

	return (
		<TypographyText
			context="code"
			as="pre"
			className={cn("p-3 rounded bg-vscode-textCodeBlock-background overflow-x-auto", className)}>
			{children}
		</TypographyText>
	)
}

export const MetadataText: React.FC<{
	children: React.ReactNode
	className?: string
	muted?: boolean
}> = ({ children, className = "", muted = true }) => {
	return (
		<TypographyText context="metadata" className={cn(muted && "text-vscode-descriptionForeground", className)}>
			{children}
		</TypographyText>
	)
}
