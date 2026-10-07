import { ADMIN, ADMIN_STATE } from "./support/accounts";
import { expect, test as setup } from "./support/test";

setup("a fresh instance leads to the setup, which creates the first administrator", async ({ page }) => {
	await page.goto("/");
	await expect(page).toHaveURL(/\/setup$/);

	await page.getByLabel("Instance name").fill("E2E SSO");
	await page.getByRole("button", { name: "Continue" }).click();
	await page.getByLabel("Name", { exact: true }).fill(ADMIN.displayName);
	await page.getByLabel("Email address").fill(ADMIN.email);
	await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
	await page.getByLabel("Confirm password", { exact: true }).fill(ADMIN.password);
	await page.getByRole("button", { name: "Complete setup" }).click();

	await expect(page.getByRole("heading", { level: 1 })).toContainText(ADMIN.displayName);
	await page.context().storageState({ path: ADMIN_STATE });
});
