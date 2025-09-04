import * as assert from "assert"
import * as fs from "fs"
import * as path from "path"
import * as vscode from "vscode"

import { RooCodeEventName, type ClineMessage } from "@roo-code/types"

import { waitUntilCompleted } from "./utils"
import { setDefaultSuiteTimeout } from "./test-utils"

suite("Conversation Memory Integration", function () {
	setDefaultSuiteTimeout(this)

	let testWorkspaceDir: string

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

		// Create a simple test file for the AI to reference
		const sampleFile = path.join(testWorkspaceDir, "sample.js")
		const sampleContent = 'console.log("Hello from test file");'
		fs.writeFileSync(sampleFile, sampleContent)

		console.log("Test files created successfully")
	})

	suiteTeardown(async () => {
		console.log("Test cleanup completed")
	})

	test("Should process conversation memory during math question", async () => {
		const api = globalThis.api

		const messages: ClineMessage[] = []

		api.on(RooCodeEventName.Message, ({ message }: { message: ClineMessage }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: {
				mode: "ask",
				alwaysAllowModeSwitch: true,
				autoApprovalEnabled: true,
			},
			text: "What is 2 + 2?",
		})

		await waitUntilCompleted({ api, taskId })

		// Verify we got a response
		assert.ok(messages.length > 0, "Expected messages during task execution")

		const hasAnswer = messages.some((msg) => msg.text && msg.text.includes("4"))
		assert.ok(hasAnswer, 'Expected answer "4" in response')

		console.log("Math question test completed")
	})

	test("Should handle simple explanation task", async () => {
		const api = globalThis.api

		const messages: ClineMessage[] = []

		api.on(RooCodeEventName.Message, ({ message }: { message: ClineMessage }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: {
				mode: "ask",
				alwaysAllowModeSwitch: true,
				autoApprovalEnabled: true,
			},
			text: "What is TypeScript?",
		})

		await waitUntilCompleted({ api, taskId })

		// Verify task completed
		assert.ok(messages.length > 0, "Expected messages during task execution")

		// Look for TypeScript-related content
		const hasTypeScriptContent = messages.some((msg) => msg.text && msg.text.toLowerCase().includes("typescript"))
		assert.ok(hasTypeScriptContent, "Expected TypeScript explanation in response")

		console.log("Explanation task test completed")
	})

	test("Should handle AI identification task", async () => {
		const api = globalThis.api

		const messages: ClineMessage[] = []

		api.on(RooCodeEventName.Message, ({ message }: { message: ClineMessage }) => {
			if (message.type === "say" && message.partial === false) {
				messages.push(message)
			}
		})

		const taskId = await api.startNewTask({
			configuration: {
				mode: "ask",
				alwaysAllowModeSwitch: true,
				autoApprovalEnabled: true,
			},
			text: "Hello! What is your name?",
		})

		await waitUntilCompleted({ api, taskId })

		// Verify we got a response with the AI's name
		assert.ok(messages.length > 0, "Expected messages during task execution")

		const hasName = messages.some((msg) => msg.text && msg.text.toLowerCase().includes("roo"))
		assert.ok(hasName, 'Expected AI to mention its name "Roo"')

		console.log("AI identification test completed")
	})
})
