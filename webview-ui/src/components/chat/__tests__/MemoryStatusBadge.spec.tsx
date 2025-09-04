import React from "react"
import { render, screen, act, waitFor } from "@/utils/test-utils"

import { vscode } from "@src/utils/vscode"
import { MemoryStatusBadge } from "../MemoryStatusBadge"

vi.mock("@/i18n/setup", () => ({
	__esModule: true,
	default: {
		use: vi.fn().mockReturnThis(),
		init: vi.fn().mockReturnThis(),
		addResourceBundle: vi.fn(),
		language: "en",
		changeLanguage: vi.fn(),
	},
	loadTranslations: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			const m: Record<string, string> = {
				"memoryStatus.ready": "Memory ready",
				"memoryStatus.notInitialized": "Memory initializing",
				"memoryStatus.codeIndexNotConfigured": "Code Index required",
				"memoryStatus.disabled": "Memory disabled",
				"memoryOperation.inProgress": "Processing...",
				"memoryOperation.completed": "Completed",
				"memoryOperation.failed": "Failed",
				"memoryOperation.started": "Started",
			}
			const clean = key.includes(":") ? key.split(":")[1] : key
			return m[clean] || clean
		},
		i18n: { language: "en", changeLanguage: vi.fn() },
	}),
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@src/utils/vscode", () => ({
	vscode: { postMessage: vi.fn() },
}))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		cwd: "/mock/workspace",
		experiments: { conversationMemory: true },
	}),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string) => {
			const m: Record<string, string> = {
				"chat:memoryStatus.ready": "Memory ready",
				"chat:memoryStatus.notInitialized": "Memory initializing",
				"chat:memoryStatus.codeIndexNotConfigured": "Code Index required",
				"chat:memoryStatus.disabled": "Memory disabled",
				"chat:memoryOperation.inProgress": "Processing...",
				"chat:memoryOperation.completed": "Completed",
				"chat:memoryOperation.failed": "Failed",
				"chat:memoryOperation.started": "Started",
			}
			return m[key] || key
		},
	}),
}))

describe("MemoryStatusBadge", () => {
	beforeEach(() => vi.clearAllMocks())

	it("requests memory status on mount", () => {
		render(<MemoryStatusBadge />)
		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "conversationMemoryStatus" })
	})

	it("shows initializing (amber) when enabled but not initialized", async () => {
		render(<MemoryStatusBadge />)
		const evt = new MessageEvent("message", {
			data: {
				type: "conversationMemoryStatus",
				payload: { enabled: true, initialized: false, codeIndexConfigured: true },
			},
		})
		act(() => window.dispatchEvent(evt))

		await waitFor(() => {
			const button = screen.getByRole("button")
			expect(button).toHaveAttribute("aria-label", expect.stringContaining("Memory initializing"))
		})
	})

	it("pulses amber during extract operation and turns red on failure", async () => {
		render(<MemoryStatusBadge />)
		// Enable memory
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "conversationMemoryStatus",
						payload: { enabled: true, initialized: false, codeIndexConfigured: true },
					},
				}),
			),
		)

		// Started
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "conversationMemoryOperation",
						payload: { operation: "extract", status: "started", message: "Processing" },
					},
				}),
			),
		)
		await waitFor(() => {
			const dot = screen.getByRole("button").querySelector("span.absolute") as HTMLElement
			expect(dot.className).toMatch(/bg-yellow-500/)
			expect(dot.className).toMatch(/animate-pulse/)
		})

		// Failed
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "conversationMemoryOperation",
						payload: { operation: "extract", status: "failed", message: "Error" },
					},
				}),
			),
		)
		await waitFor(() => {
			const dot = screen.getByRole("button").querySelector("span.absolute") as HTMLElement
			expect(dot.className).toMatch(/bg-red-500/)
		})
	})

	it("turns green when ready and idle", async () => {
		render(<MemoryStatusBadge />)
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "conversationMemoryStatus",
						payload: { enabled: true, initialized: true, codeIndexConfigured: true },
					},
				}),
			),
		)
		await waitFor(() => {
			const dot = screen.getByRole("button").querySelector("span.absolute") as HTMLElement
			expect(dot.className).toMatch(/bg-green-500/)
		})
	})

	it("shows brain icon during extract operations", async () => {
		render(<MemoryStatusBadge />)
		// Enable memory
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "conversationMemoryStatus",
						payload: { enabled: true, initialized: true, codeIndexConfigured: true },
					},
				}),
			),
		)

		// Start extract operation
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: {
						type: "conversationMemoryOperation",
						payload: { operation: "extract", status: "started", message: "Extracting information" },
					},
				}),
			),
		)
		await waitFor(() => {
			const button = screen.getByRole("button")
			// Look for Brain icon specifically by its class name
			const brainIcon = button.querySelector("svg.lucide-brain")
			expect(brainIcon).toBeInTheDocument()
			// Verify it has the correct size classes
			expect(brainIcon).toHaveClass("w-3", "h-3")
		})
	})
})
