import React from "react"
import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import ConversationMemorySearchView from "../ConversationMemorySearchView"

// Mock the translation context
vi.mock("@src/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, defaultValue?: string) => defaultValue || key,
	}),
}))

// Mock the vscode utility
vi.mock("@src/utils/vscode", () => ({
	vscode: {
		postMessage: vi.fn(),
	},
}))

// Mock the ExtensionStateContext
vi.mock("@src/context/ExtensionStateContext", () => ({
	useExtensionState: () => ({
		// Mock extension state values needed by components
		experiments: { conversationMemory: true },
		conversationMemoryPromptBudgetTokens: 400,
		conversationMemoryToolDefaultLimit: 10,
		conversationMemoryDailyBudgetUSD: 1.0,
	}),
}))

// Mock the Tab components
vi.mock("@src/components/common/Tab", () => ({
	Tab: ({ children }: any) => <div data-testid="tab">{children}</div>,
	TabHeader: ({ children }: any) => <div data-testid="tab-header">{children}</div>,
	TabContent: ({ children }: any) => <div data-testid="tab-content">{children}</div>,
}))

// Mock Virtuoso component
vi.mock("react-virtuoso", () => ({
	Virtuoso: ({ data, itemContent, components }: any) => (
		<div data-testid="virtuoso-container">
			{data?.map((item: any, index: number) => (
				<div key={item.id || index} data-testid="virtuoso-item">
					{itemContent(index, item)}
				</div>
			))}
			{components?.EmptyPlaceholder && data?.length === 0 && <components.EmptyPlaceholder />}
		</div>
	),
}))

// Mock VSCode components
vi.mock("@vscode/webview-ui-toolkit/react", () => ({
	VSCodeTextField: ({ children, ...props }: any) => (
		<div data-testid="vscode-text-field-container" {...props}>
			<input data-testid="search-input" {...props} />
			{children}
		</div>
	),
	VSCodeProgressRing: (props: any) => <div data-testid="vscode-progress-ring" {...props} />,
}))

// Mock UI components
vi.mock("@src/components/ui", () => ({
	Select: ({ children, value, onValueChange }: any) => (
		<div data-testid="select" data-value={value}>
			<select value={value} onChange={(e) => onValueChange?.(e.target.value)}>
				{children}
			</select>
		</div>
	),
	SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
	SelectItem: ({ children, value }: any) => (
		<option value={value} data-testid={`select-item-${value}`}>
			{children}
		</option>
	),
	SelectTrigger: ({ children }: any) => <div data-testid="select-trigger">{children}</div>,
	SelectValue: ({ children }: any) => <div data-testid="select-value">{children}</div>,
	Slider: ({ value, onValueChange, ...props }: any) => (
		<input
			data-testid="slider"
			type="range"
			value={value?.[0] || 0}
			onChange={(e) => onValueChange?.([parseFloat(e.target.value)])}
			{...props}
		/>
	),
}))

describe("ConversationMemorySearchView", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders the main search interface", () => {
		render(<ConversationMemorySearchView />)

		// Check main title is present
		expect(screen.getByText("Search Memories")).toBeInTheDocument()

		// Check description is present
		expect(
			screen.getByText(
				"Search through your conversation memories to find facts, insights, and past discussions.",
			),
		).toBeInTheDocument()

		// Check search input is present (there are multiple elements with this ID)
		expect(screen.getAllByTestId("memory-search-input")[0]).toBeInTheDocument()

		// Check filter components are present
		expect(screen.getAllByTestId("select")).toHaveLength(2) // Time range and episode type selects
		expect(screen.getByTestId("slider")).toBeInTheDocument()
	})

	it("renders with onDone callback", () => {
		const onDone = vi.fn()
		render(<ConversationMemorySearchView onDone={onDone} />)

		// Check close button is present
		const closeButton = screen.getByLabelText("Close")
		expect(closeButton).toBeInTheDocument()
	})

	it("shows empty search state initially", () => {
		render(<ConversationMemorySearchView />)

		// Should show empty search message
		expect(screen.getByText("Enter a search query to find memories")).toBeInTheDocument()
		expect(
			screen.getByText("Search for conversations, facts, or insights from your previous interactions"),
		).toBeInTheDocument()
	})

	it("renders all required components", () => {
		render(<ConversationMemorySearchView />)

		// Check that the search input field exists (there are multiple elements with this ID)
		const searchInput = screen.getAllByTestId("memory-search-input")[0]
		expect(searchInput).toBeInTheDocument()

		// Check that filter selects exist
		const selects = screen.getAllByTestId("select")
		expect(selects).toHaveLength(2)

		// Check that slider exists
		const slider = screen.getByTestId("slider")
		expect(slider).toBeInTheDocument()

		// Check that tab components exist
		const tab = screen.getByTestId("tab")
		expect(tab).toBeInTheDocument()

		const tabHeader = screen.getByTestId("tab-header")
		expect(tabHeader).toBeInTheDocument()

		const tabContent = screen.getByTestId("tab-content")
		expect(tabContent).toBeInTheDocument()
	})
})
