import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { SetupForm } from "@/components/auth/setup-form";
import { loadPage } from "@/lib/browser";
import { apiError, mockApi } from "../../../support/api";
import { me } from "../../../support/fixtures";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.setup;
const PASSWORD = "a sufficiently long password";

const next = () => page.getByRole("button", { name: t.next });
const submit = () => page.getByRole("button", { name: t.submit });

async function fillAccount(confirmation = PASSWORD) {
	await page.getByLabelText(t.displayName).fill("Ada Lovelace");
	await page.getByLabelText(t.email).fill("ada@example.com");
	await page.getByLabelText(t.password, { exact: true }).fill(PASSWORD);
	await page.getByLabelText(t.passwordConfirmation, { exact: true }).fill(confirmation);
}

describe("SetupForm", () => {
	it("names the instance, creates the admin account and opens the administration", async () => {
		const server = mockApi({ "POST /api/setup": { body: me() } });
		await renderUi(<SetupForm />);

		await expect.element(page.getByRole("navigation", { name: translate("setup.progress", { current: 1, total: 2 }) })).toBeVisible();
		await expect.element(page.getByLabelText(t.instanceName)).toHaveValue("Aegis");
		await page.getByLabelText(t.instanceName).fill("Example SSO");
		await expect.element(page.getByRole("figure").getByText("Example SSO")).toBeInTheDocument();
		await next().click();

		await expect.element(page.getByText(translate("setup.accountDescription", { instance: "Example SSO" }))).toBeVisible();
		await expect.element(page.getByRole("button", { name: `${t.instanceStep}, ${t.stepComplete}` })).toBeVisible();
		await fillAccount();
		await expect.element(page.getByText(t.passwordsMatch)).toBeVisible();
		await submit().click();

		expect(server.calls("POST /api/setup")[0]?.body).toEqual({
			instanceName: "Example SSO",
			displayName: "Ada Lovelace",
			email: "ada@example.com",
			password: PASSWORD,
		});
		expect(loadPage).toHaveBeenCalledWith("/");
	});

	it("moves between the steps, checking the instance name before it goes forward", async () => {
		await renderUi(<SetupForm />);

		await page.getByLabelText(t.instanceName).fill(" ");
		await expect.element(page.getByRole("figure").getByText("Aegis")).toBeInTheDocument();
		await page.getByRole("button", { name: new RegExp(t.accountStep) }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.required)).toBeVisible();

		await page.getByLabelText(t.instanceName).fill("Example SSO");
		await page.getByRole("button", { name: new RegExp(t.accountStep) }).click();
		await expect.element(page.getByLabelText(t.displayName)).toBeVisible();
		await page.getByRole("button", { name: t.back }).click();
		await expect.element(page.getByLabelText(t.instanceName)).toHaveValue("Example SSO");
		await next().click();
		await page.getByRole("button", { name: new RegExp(t.instanceStep) }).click();
		await expect.element(page.getByLabelText(t.instanceName)).toBeVisible();
	});

	it("checks the account and reports what the server rejects", async () => {
		const server = mockApi({ "POST /api/setup": apiError(400, "validation_failed", [{ path: "email", code: "email_invalid" }]) });
		await renderUi(<SetupForm />);
		await next().click();

		await submit().click();
		await expect.element(page.getByText(MESSAGES.en.validation.required).first()).toBeVisible();
		await fillAccount("another password");
		await submit().click();
		await expect.element(page.getByText(MESSAGES.en.validation.password_mismatch)).toBeVisible();
		expect(server.calls("POST /api/setup")).toEqual([]);

		await page.getByLabelText(t.passwordConfirmation, { exact: true }).fill(PASSWORD);
		await submit().click();
		await expect.element(page.getByText(MESSAGES.en.validation.email_invalid)).toBeVisible();

		server.on({ "POST /api/setup": apiError(500, "internal_error") });
		await submit().click();
		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();

		// The instance name lives on the first step, so a rejected one is shown there.
		server.on({ "POST /api/setup": apiError(400, "validation_failed", [{ path: "instanceName", code: "too_long" }]) });
		await submit().click();
		await expect.element(page.getByLabelText(t.instanceName)).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.validation.too_long)).toBeVisible();
	});

	it("leads to the sign-in when another setup finished first", async () => {
		mockApi({ "POST /api/setup": apiError(409, "setup_completed") });
		await renderUi(<SetupForm />);
		await next().click();
		await fillAccount();

		await submit().click();

		expect(loadPage).toHaveBeenCalledWith("/sign-in");
	});
});
