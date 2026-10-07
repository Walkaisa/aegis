import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests of the Docker image: a real browser against Aegis and PostgreSQL in containers
 * (`e2e/support/global-setup.ts`). Build the image first, e.g. `docker build -t aegis:e2e .`, or
 * point `AEGIS_E2E_IMAGE` at another tag.
 */
export default defineConfig({
	testDir: "e2e",
	globalSetup: "./e2e/support/global-setup.ts",
	// One instance serves every test; the specs share its accounts and applications.
	fullyParallel: false,
	workers: 1,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
	timeout: 30_000,
	expect: { timeout: 10_000 },
	use: {
		// Set by the global setup once the container listens.
		baseURL: process.env.AEGIS_E2E_URL,
		locale: "en-US",
		timezoneId: "UTC",
		trace: "retain-on-failure",
	},
	projects: [
		{ name: "setup", testMatch: /setup\.ts$/, use: devices["Desktop Chrome"] },
		{ name: "chromium", dependencies: ["setup"], testIgnore: /setup\.ts$/, use: devices["Desktop Chrome"] },
	],
});
