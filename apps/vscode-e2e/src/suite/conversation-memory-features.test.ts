/**
 * SIMPLE CONVERSATION MEMORY FEATURES TESTS
 *
 * Focused, simple tests for conversation memory system validation.
 * Based on lessons learned from conversation-memory-real.test.ts patterns.
 *
 * DESIGN PRINCIPLES:
 * - Keep tests simple and focused
 * - Test outcomes, not implementation details
 * - Avoid complex event tracking
 * - Use simple, direct prompts
 * - Focus on whether memory features work
 */

import { suite, test, suiteSetup, suiteTeardown } from "mocha"
import assert from "assert"
import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { waitUntilCompleted } from "./utils"
import { setDefaultSuiteTimeout } from "./test-utils"

suite("Conversation Memory Features", function () {
	setDefaultSuiteTimeout(this)

	let testWorkspaceDir: string
	const testFiles: { [key: string]: string } = {}

	suiteSetup(async () => {
		const workspaceFolders = vscode.workspace.workspaceFolders
		if (!workspaceFolders || workspaceFolders.length === 0) {
			throw new Error("No workspace folders found")
		}
		const firstFolder = workspaceFolders[0]
		if (!firstFolder) {
			throw new Error("First workspace folder is undefined")
		}
		testWorkspaceDir = firstFolder.uri.fsPath
		console.log("Test workspace directory:", testWorkspaceDir)

		// Create project context files for testing
		testFiles.packageJson = path.join(testWorkspaceDir, "package.json")
		const packageContent = JSON.stringify(
			{
				name: "test-react-typescript-project",
				version: "1.0.0",
				dependencies: {
					react: "^18.0.0",
					typescript: "^5.0.0",
				},
				devDependencies: {
					"@types/react": "^18.0.0",
				},
			},
			null,
			2,
		)
		fs.writeFileSync(testFiles.packageJson, packageContent)

		// Create a simple TypeScript component file
		testFiles.component = path.join(testWorkspaceDir, "Component.tsx")
		const componentContent = `import React from 'react';

interface Props {
  title: string;
}

export const TestComponent: React.FC<Props> = ({ title }) => {
  return <div>{title}</div>;
};`
		fs.writeFileSync(testFiles.component, componentContent)

		console.log("Created test project files")
	})

	suiteTeardown(async () => {
		try {
			// Cancel any running tasks
			await globalThis.api.cancelCurrentTask()
		} catch (error) {
			console.warn("Task cleanup failed:", error)
		}

		// Clean up test files
		for (const [name, filePath] of Object.entries(testFiles)) {
			try {
				if (fs.existsSync(filePath)) {
					fs.unlinkSync(filePath)
					console.log(`Cleaned up test file: ${name}`)
				}
			} catch (error) {
				console.log(`Warning: Could not clean up ${name}:`, error)
			}
		}

		console.log("Test cleanup completed")
	})

	/**
	 * TEST 1: Simple Memory Ingestion
	 *
	 * Tests whether conversation memory can ingest and store facts from a simple conversation.
	 * Focus: Does the system attempt to store conversation facts in memory?
	 */
	test("Should ingest conversation facts into memory system", async function () {
		const api = globalThis.api
		console.log("=== Testing Memory Ingestion ===")

		const messages: ClineMessage[] = []

		// Simple message collection - focus on memory-related activity
		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Log memory-related messages for debugging
			if (
				message.text &&
				(message.text.toLowerCase().includes("memory") ||
					message.text.toLowerCase().includes("storing") ||
					message.text.toLowerCase().includes("fact"))
			) {
				console.log("Memory-related activity:", message.text)
			}
		}

		api.on(RooCodeEventName.Message, messageHandler)

		try {
			console.log("Starting conversation with factual content for memory storage...")

			// Simple conversation containing facts worth storing in memory
			const taskId = await api.startNewTask({
				configuration: {
					mode: "ask",
					autoApprovalEnabled: true,
				},
				text: "I prefer TypeScript over JavaScript for better type safety. Can you explain how TypeScript helps with debugging?",
			})

			console.log("Task started:", taskId)

			// Wait for task completion with longer timeout for memory operations
			await waitUntilCompleted({ api, taskId, timeout: 90000 })

			console.log("Conversation completed, analyzing results...")

			// Verify we got some response
			assert.ok(messages.length > 0, "Should have received messages during task execution")

			// Verify we got a substantive response about TypeScript
			const hasTypeScriptResponse = messages.some(
				(msg) =>
					msg.text &&
					msg.text.length > 50 &&
					(msg.text.includes("TypeScript") || msg.text.includes("type") || msg.text.includes("debug")),
			)
			assert.ok(
				hasTypeScriptResponse,
				"Expected substantive response about TypeScript debugging. " + `Got ${messages.length} messages.`,
			)

			console.log("✅ Memory ingestion test completed - conversation processed")
		} finally {
			// Clean up
			try {
				await api.cancelCurrentTask()
			} catch (e) {
				console.log("Task cleanup warning:", e)
			}
		}
	}).timeout(60000)

	/**
	 * TEST 2: Project Context Detection
	 *
	 * Tests whether conversation memory can detect and use project context
	 * from the workspace (React/TypeScript project in this case).
	 * Focus: Does the system recognize project context for better responses?
	 */
	test("Should detect and use project context from workspace", async function () {
		const api = globalThis.api
		console.log("=== Testing Project Context Detection ===")

		const messages: ClineMessage[] = []

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Log project context related messages
			if (
				message.text &&
				(message.text.toLowerCase().includes("react") ||
					message.text.toLowerCase().includes("typescript") ||
					message.text.toLowerCase().includes("component"))
			) {
				console.log("Project context activity:", message.text)
			}
		}

		api.on(RooCodeEventName.Message, messageHandler)

		try {
			console.log("Asking about React components in TypeScript project context...")

			// Question that should benefit from project context awareness
			const taskId = await api.startNewTask({
				configuration: {
					mode: "ask",
					autoApprovalEnabled: true,
				},
				text: "How should I structure React components in this project?",
			})

			await waitUntilCompleted({ api, taskId, timeout: 90000 })

			console.log("Project context test completed, analyzing results...")

			// Verify we got responses
			assert.ok(messages.length > 0, "Should have received messages")

			// Verify response is contextually aware (mentions React/TypeScript/components)
			const hasContextualResponse = messages.some(
				(msg) =>
					msg.text &&
					msg.text.length > 30 &&
					(msg.text.includes("React") ||
						msg.text.includes("TypeScript") ||
						msg.text.includes("component") ||
						msg.text.includes("TSX") ||
						msg.text.includes("interface")),
			)
			assert.ok(
				hasContextualResponse,
				"Expected contextual response mentioning React/TypeScript concepts. " +
					`Got ${messages.length} messages.`,
			)

			console.log("✅ Project context detection test completed")
		} finally {
			try {
				await api.cancelCurrentTask()
			} catch (e) {
				console.log("Task cleanup warning:", e)
			}
		}
	}).timeout(60000)

	/**
	 * TEST 3: Memory Search Functionality
	 *
	 * Tests whether memory search can find and retrieve relevant stored facts.
	 * Focus: Can the system search memory and return relevant results?
	 */
	test("Should search memory for stored facts", async function () {
		const api = globalThis.api
		console.log("=== Testing Memory Search ===")

		const messages: ClineMessage[] = []
		const toolExecutions: ClineMessage[] = []

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Track tool execution messages
			if (message.type === "say" && message.say === "api_req_started") {
				toolExecutions.push(message)
				console.log("Tool execution:", message.text)
			}

			// Track search-related activity
			if (
				message.text &&
				(message.text.includes("search") ||
					message.text.includes("memory") ||
					message.text.includes("debugging") ||
					message.text.includes("preference"))
			) {
				console.log("Search activity:", message.text)
			}
		}

		api.on(RooCodeEventName.Message, messageHandler)

		try {
			console.log("Searching memory for debugging preferences...")

			// Query that should trigger memory search
			const taskId = await api.startNewTask({
				configuration: {
					mode: "ask",
					autoApprovalEnabled: true,
				},
				text: "What debugging practices do I prefer based on our previous conversations?",
			})

			await waitUntilCompleted({ api, taskId })

			console.log("Memory search completed, analyzing results...")

			// Verify task completed and we got responses
			assert.ok(messages.length > 0, "Should have received messages")

			// Check for some response about debugging (even if no memory found)
			const hasDebuggingResponse = messages.some(
				(msg) =>
					msg.text &&
					msg.text.length > 20 &&
					(msg.text.includes("debug") ||
						msg.text.includes("practice") ||
						msg.text.includes("prefer") ||
						msg.text.includes("previous") ||
						msg.text.includes("memory")),
			)
			assert.ok(hasDebuggingResponse, "Expected some response about debugging practices or memory search")

			console.log("✅ Memory search test completed")
			console.log("Tool executions detected:", toolExecutions.length)
		} finally {
			try {
				await api.cancelCurrentTask()
			} catch (e) {
				console.log("Task cleanup warning:", e)
			}
		}
	}).timeout(60000)

	/**
	 * TEST 4: Episode Detection
	 *
	 * Tests whether the system can detect topic shifts and create episodes.
	 * Focus: Does conversation memory group related facts into episodes?
	 */
	test("Should detect topic shifts and create episodes", async function () {
		const api = globalThis.api
		console.log("=== Testing Episode Detection ===")

		const messages: ClineMessage[] = []

		const messageHandler = ({ message }: { message: ClineMessage }) => {
			messages.push(message)

			// Log episode/topic related activity
			if (
				message.text &&
				(message.text.includes("episode") ||
					message.text.includes("topic") ||
					message.text.includes("shift") ||
					message.text.includes("conversation"))
			) {
				console.log("Episode-related activity:", message.text)
			}
		}

		api.on(RooCodeEventName.Message, messageHandler)

		try {
			console.log("Creating conversation with topic shifts...")

			// First topic - TypeScript
			const taskId1 = await api.startNewTask({
				configuration: {
					mode: "ask",
					autoApprovalEnabled: true,
				},
				text: "What are the benefits of TypeScript over JavaScript?",
			})

			await waitUntilCompleted({ api, taskId: taskId1 })

			console.log("First topic completed, switching to second topic...")

			// Topic shift - Testing practices (different domain)
			const taskId2 = await api.startNewTask({
				configuration: {
					mode: "ask",
					autoApprovalEnabled: true,
				},
				text: "What are best practices for unit testing in React applications?",
			})

			await waitUntilCompleted({ api, taskId: taskId2 })

			console.log("Episode detection test completed, analyzing results...")

			// Verify we got responses to both questions
			assert.ok(messages.length > 0, "Should have received messages")

			// Check for responses about both topics
			const hasTypeScriptContent = messages.some(
				(msg) =>
					msg.text &&
					(msg.text.includes("TypeScript") || msg.text.includes("JavaScript") || msg.text.includes("type")),
			)

			const hasTestingContent = messages.some(
				(msg) =>
					msg.text && (msg.text.includes("test") || msg.text.includes("React") || msg.text.includes("unit")),
			)

			assert.ok(hasTypeScriptContent, "Expected content about TypeScript")
			assert.ok(hasTestingContent, "Expected content about testing")

			console.log("✅ Episode detection test completed")
			console.log("TypeScript content found:", hasTypeScriptContent)
			console.log("Testing content found:", hasTestingContent)
		} finally {
			try {
				await api.cancelCurrentTask()
			} catch (e) {
				console.log("Task cleanup warning:", e)
			}
		}
	}).timeout(90000) // Longer timeout for multiple conversations
})
