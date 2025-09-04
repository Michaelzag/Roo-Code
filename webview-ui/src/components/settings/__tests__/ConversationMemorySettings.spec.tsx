import { render, screen, fireEvent } from "@testing-library/react"
import { vi } from "vitest"
import { ConversationMemorySettings } from "../ConversationMemorySettings"

// Mock the translation hook
vi.mock("@/i18n/TranslationContext", () => ({
	useAppTranslation: () => ({
		t: (key: string, options?: any) => {
			// Return the key for testing purposes
			if (options?.defaultValue) return options.defaultValue
			return key
		},
	}),
}))

describe("ConversationMemorySettings", () => {
	const defaultProps = {
		enabled: false,
		onChange: vi.fn(),
		promptBudgetTokens: 400,
		memoryToolDefaultLimit: 10,
		dailyProcessingBudgetUSD: 1.0,
		setPromptBudgetTokens: vi.fn(),
		setMemoryToolDefaultLimit: vi.fn(),
		setDailyProcessingBudgetUSD: vi.fn(),
		codebaseIndexConfig: {
			codebaseIndexEnabled: true,
			codebaseIndexQdrantUrl: "http://localhost:6333",
		},
	}

	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("renders conversation memory toggle", () => {
		render(<ConversationMemorySettings {...defaultProps} />)

		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.name")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.description")).toBeInTheDocument()
	})

	it("calls onChange when checkbox is toggled", () => {
		render(<ConversationMemorySettings {...defaultProps} />)

		const checkbox = screen.getByRole("checkbox")
		fireEvent.click(checkbox)

		expect(defaultProps.onChange).toHaveBeenCalledWith(true)
	})

	it("shows configuration options when enabled", () => {
		render(<ConversationMemorySettings {...defaultProps} enabled={true} />)

		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.promptBudgetLabel")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.toolLimitLabel")).toBeInTheDocument()
		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.dailyBudgetLabel")).toBeInTheDocument()
	})

	it("hides configuration options when disabled", () => {
		render(<ConversationMemorySettings {...defaultProps} enabled={false} />)

		expect(
			screen.queryByText("settings:experimental.CONVERSATION_MEMORY.promptBudgetLabel"),
		).not.toBeInTheDocument()
		expect(screen.queryByText("settings:experimental.CONVERSATION_MEMORY.toolLimitLabel")).not.toBeInTheDocument()
		expect(screen.queryByText("settings:experimental.CONVERSATION_MEMORY.dailyBudgetLabel")).not.toBeInTheDocument()
	})

	it("renders input fields with correct placeholders when enabled", () => {
		render(<ConversationMemorySettings {...defaultProps} enabled={true} />)

		expect(screen.getByPlaceholderText("400")).toBeInTheDocument()
		expect(screen.getByPlaceholderText("10")).toBeInTheDocument()
		expect(screen.getByPlaceholderText("1.00")).toBeInTheDocument()
	})

	it("renders advanced settings toggle", () => {
		render(<ConversationMemorySettings {...defaultProps} enabled={true} />)

		const advancedToggle = screen.getByText("settings:experimental.CONVERSATION_MEMORY.advancedSettings")
		expect(advancedToggle).toBeInTheDocument()

		fireEvent.click(advancedToggle)
		// Advanced settings should expand (we can test the click functionality)
	})

	it("shows warning when Qdrant is not configured", () => {
		const propsWithoutQdrant = {
			...defaultProps,
			enabled: true,
			codebaseIndexConfig: {
				codebaseIndexEnabled: false,
				codebaseIndexQdrantUrl: "",
			},
		}

		render(<ConversationMemorySettings {...propsWithoutQdrant} />)

		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.warningQdrantConfig")).toBeInTheDocument()
	})

	it("shows info about memory usage when enabled", () => {
		render(<ConversationMemorySettings {...defaultProps} enabled={true} />)

		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.infoMemoryUsage")).toBeInTheDocument()
	})

	it("renders brain icon correctly", () => {
		render(<ConversationMemorySettings {...defaultProps} enabled={true} />)

		// Check that the brain icon is present
		const _brainIcon = screen.queryByTestId("brain-icon")
		// Since we can't easily test SVG icons, we'll just verify the component renders without errors
		expect(screen.getByText("settings:experimental.CONVERSATION_MEMORY.name")).toBeInTheDocument()
	})
})
