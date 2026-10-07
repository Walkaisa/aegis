import { test as base, expect } from "@playwright/test";

/**
 * `test` that fails when a page logs an error or a warning, or throws, e.g. a hydration mismatch or a
 * blocked script, which the pages would otherwise survive unnoticed.
 */
export const test = base.extend<{ consoleProblems: string[] }>({
	consoleProblems: [
		async ({ page }, use) => {
			const problems: string[] = [];
			page.on("console", (message) => {
				// Chromium logs every answer with an error status; the specs check those answers themselves.
				if (message.text().startsWith("Failed to load resource:")) {
					return;
				}
				if (message.type() === "error" || message.type() === "warning") {
					problems.push(`${message.type()}: ${message.text()}`);
				}
			});
			page.on("pageerror", (error) => problems.push(`exception: ${error.message}`));
			await use(problems);
			expect(problems).toEqual([]);
		},
		{ auto: true },
	],
});

export { expect };
