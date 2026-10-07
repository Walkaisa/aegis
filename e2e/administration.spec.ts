import { type Page, request } from "@playwright/test";
import { ADMIN, ADMIN_STATE, createUser, USER_PASSWORD } from "./support/accounts";
import { expect, test } from "./support/test";

async function signIn(page: Page, email: string, password: string) {
	await page.goto("/sign-in");
	await page.getByLabel("Email address").fill(email);
	await page.getByLabel("Password", { exact: true }).fill(password);
	await page.getByRole("button", { name: "Sign in" }).click();
}

test.describe("administration", () => {
	test("an administrator signs in, finds their way and signs out", async ({ page }) => {
		await page.goto("/users");
		await expect(page).toHaveURL(/\/sign-in\?next=%2Fusers$/);

		await page.getByLabel("Email address").fill(ADMIN.email);
		await page.getByLabel("Password", { exact: true }).fill(ADMIN.password);
		await page.getByRole("button", { name: "Sign in" }).click();
		await expect(page).toHaveURL(/\/users$/);
		await expect(page.getByRole("cell", { name: ADMIN.email })).toBeVisible();

		await page.getByRole("link", { name: "Audit log" }).first().click();
		await expect(page.getByText(/signed in/).first()).toBeVisible();

		await page.getByRole("button", { name: new RegExp(ADMIN.displayName) }).click();
		await page.getByRole("menuitem", { name: "Sign out" }).click();
		await expect(page).toHaveURL(/\/sign-in$/);
		await page.goto("/");
		await expect(page).toHaveURL(/\/sign-in/);
	});

	test("a wrong password gets no further than the sign-in", async ({ page }) => {
		await signIn(page, ADMIN.email, "not the password");

		await expect(page.getByRole("alert")).toBeVisible();
		await expect(page).toHaveURL(/\/sign-in$/);
	});

	test("an account without administration rights cannot open it", async ({ page, baseURL }) => {
		const api = await request.newContext({ baseURL, storageState: ADMIN_STATE });
		const user = await createUser(api);
		await api.dispose();

		await signIn(page, user.email, USER_PASSWORD);

		await expect(page.getByText("This account has no access to the administration.", { exact: false })).toBeVisible();
	});
});
