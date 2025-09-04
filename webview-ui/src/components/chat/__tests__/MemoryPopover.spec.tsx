import React from "react"
import { render, screen, fireEvent, act, waitFor } from "@/utils/test-utils"
import { vscode } from "@src/utils/vscode"
import { MemoryPopover } from "../MemoryPopover"

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
	useTranslation: () => ({ t: (k: string) => k }),
	initReactI18next: { type: "3rdParty", init: vi.fn() },
	Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@src/utils/vscode", () => ({ vscode: { postMessage: vi.fn() } }))

vi.mock("@/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		experiments: { conversationMemory: true },
		codebaseIndexConfig: {
			codebaseIndexEnabled: true,
			codebaseIndexQdrantUrl: "http://localhost:6333",
			codebaseIndexEmbedderProvider: "openai",
		},
		conversationMemoryPromptBudgetTokens: 400,
		conversationMemoryToolDefaultLimit: 10,
		conversationMemoryDailyBudgetUSD: 1.0,
	}),
	ExtensionStateContextProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, _params?: any) => {
			const m: Record<string, string> = {
				"chat:memorySettings.search": "Search Memories",
				"common:search": "Search",
				"common:searching": "Searching...",
				"chat:memorySettings.searchPlaceholder": "e.g., authentication decisions",
				"chat:memorySettings.episodes": "Episodes",
				"chat:memorySettings.facts": "Facts",
			}
			return m[key] || key
		},
	}),
}))

vi.mock("@src/components/ui", () => ({
	Popover: ({ children }: { children: React.ReactNode }) => <div data-testid="popover">{children}</div>,
	PopoverContent: ({ children }: { children: React.ReactNode }) => (
		<div data-testid="popover-content">{children}</div>
	),
	Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (value: number[]) => void }) => (
		<input
			type="range"
			value={value[0]}
			onChange={(e) => onValueChange([parseInt(e.target.value)])}
			data-testid="slider"
		/>
	),
	AlertDialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	AlertDialogAction: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
		<button onClick={onClick}>{children}</button>
	),
	AlertDialogCancel: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}))

describe("MemoryPopover - search", () => {
	beforeEach(() => vi.clearAllMocks())

	const mount = () =>
		render(
			<MemoryPopover memoryStatus={{ initialized: true, enabled: true, codeIndexConfigured: true }}>
				<button>trigger</button>
			</MemoryPopover>,
		)

	it("posts memorySearch when clicking Search", async () => {
		mount()

		const input = screen.getByPlaceholderText("e.g., authentication decisions") as HTMLInputElement
		fireEvent.change(input, { target: { value: "auth decisions" } })
		const button = screen.getByText("Search")
		fireEvent.click(button)

		expect(vscode.postMessage).toHaveBeenCalledWith({ type: "memorySearch", query: "auth decisions", limit: 10 })
	})

	it("renders facts results", async () => {
		mount()

		const input = screen.getByPlaceholderText("e.g., authentication decisions") as HTMLInputElement
		fireEvent.change(input, { target: { value: "jwt" } })
		fireEvent.click(screen.getByText("Search"))

		const facts = [
			{ category: "architecture", content: "Switched to session auth" },
			{ category: "infrastructure", content: "Using PostgreSQL" },
		]
		const evt = new MessageEvent("message", {
			data: { type: "memorySearchResults", values: { success: true, facts } },
		})
		act(() => window.dispatchEvent(evt))

		await waitFor(() => {
			expect(screen.getByText("Facts")).toBeInTheDocument()
			expect(screen.getByText(/ARCHITECTURE: Switched to session auth/i)).toBeInTheDocument()
			expect(screen.getByText(/INFRASTRUCTURE: Using PostgreSQL/i)).toBeInTheDocument()
		})
	})

	it("renders episodes results", async () => {
		mount()

		fireEvent.change(screen.getByPlaceholderText("e.g., authentication decisions"), { target: { value: "auth" } })
		fireEvent.click(screen.getByText("Search"))

		const episodes = [
			{
				episode_context: "Auth planning",
				fact_count: 2,
				facts: [{ category: "architecture", content: "JWT chosen" }],
			},
		]
		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "memorySearchResults", values: { success: true, episodes } },
				}),
			),
		)

		await waitFor(() => {
			expect(screen.getByText("Episodes")).toBeInTheDocument()
			expect(screen.getByText(/Auth planning/)).toBeInTheDocument()
			expect(screen.getByText(/ARCHITECTURE: JWT chosen/)).toBeInTheDocument()
		})
	})

	it("shows search error", async () => {
		mount()

		fireEvent.change(screen.getByPlaceholderText("e.g., authentication decisions"), { target: { value: "oops" } })
		fireEvent.click(screen.getByText("Search"))

		act(() =>
			window.dispatchEvent(
				new MessageEvent("message", {
					data: { type: "memorySearchResults", values: { success: false, error: "No results" } },
				}),
			),
		)

		await waitFor(() => {
			expect(screen.getByText("No results")).toBeInTheDocument()
		})
	})
})
