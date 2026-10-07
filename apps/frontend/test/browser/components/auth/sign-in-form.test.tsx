import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { SignInForm } from "@/components/auth/sign-in-form";
import { loadPage } from "@/lib/browser";
import { apiError, mockApi, type Route } from "../../../support/api";
import { instanceInfo, me, secondFactorPrompt } from "../../../support/fixtures";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.signIn;
const tTwoFactor = MESSAGES.en.twoFactor.signIn;

async function renderForm(routes: Record<string, Route> = {}) {
	const server = mockApi({ "GET /api/instance": { body: instanceInfo() }, ...routes });
	await renderUi(<SignInForm />);
	return server;
}

async function signIn(email = "ada@example.com", password = "correct horse battery staple") {
	await page.getByLabelText(t.email).fill(email);
	await page.getByLabelText(t.password, { exact: true }).fill(password);
	await page.getByRole("button", { name: t.submit }).click();
}

describe("SignInForm", () => {
	it("signs an admin in and continues where they wanted to go", async () => {
		window.history.replaceState(null, "", "/sign-in?next=/users");
		const server = await renderForm({ "POST /api/auth/session": { body: { type: "signed_in", ...me() } } });

		await expect.element(page.getByText("Sign in to manage Example SSO.")).toBeVisible();
		await expect.element(page.getByRole("link", { name: MESSAGES.en.forgotPassword.title })).toBeVisible();
		await signIn();

		expect(server.calls("POST /api/auth/session")[0]?.body).toEqual({
			email: "ada@example.com",
			password: "correct horse battery staple",
		});
		expect(loadPage).toHaveBeenCalledWith(`${window.location.origin}/users`);
	});

	it("asks for the second factor before it continues", async () => {
		const server = await renderForm({
			"POST /api/auth/session": { body: secondFactorPrompt() },
			"POST /api/auth/session/second-factor": { body: { type: "signed_in", ...me() } },
		});

		await signIn();
		await page.getByLabelText(tTwoFactor.codeLabel).fill("123456");

		expect(server.calls("POST /api/auth/session/second-factor")[0]?.body).toEqual({ code: "123456" });
		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith(`${window.location.origin}/`));
	});

	it("goes back to the password for another account or after the second step expired", async () => {
		await renderForm({
			"POST /api/auth/session": { body: secondFactorPrompt() },
			"POST /api/auth/session/second-factor": apiError(401, "second_factor_expired"),
		});

		await signIn();
		await page.getByRole("button", { name: tTwoFactor.notYou }).click();
		await expect.element(page.getByLabelText(t.password, { exact: true })).toHaveValue("");
		await expect.element(page.getByLabelText(t.email)).toHaveValue("ada@example.com");

		await page.getByLabelText(t.password, { exact: true }).fill("correct horse battery staple");
		await page.getByRole("button", { name: t.submit }).click();
		await page.getByLabelText(tTwoFactor.codeLabel).fill("123456");
		await expect.element(page.getByText(tTwoFactor.expired)).toBeVisible();
	});

	it("checks the input and explains what went wrong", async () => {
		const server = await renderForm({ "POST /api/auth/session": apiError(403, "forbidden") });

		await page.getByRole("button", { name: t.submit }).click();
		expect(page.getByText(MESSAGES.en.validation.required).elements()).toHaveLength(2);
		expect(server.calls("POST /api/auth/session")).toEqual([]);

		await signIn("grace@example.com");
		await expect.element(page.getByText(t.forbidden)).toBeVisible();
		await expect.element(page.getByLabelText(t.password, { exact: true })).toHaveValue("");

		server.on({ "POST /api/auth/session": apiError(401, "sign_in_failed") });
		await signIn();
		await expect.element(page.getByText(MESSAGES.en.errors.sign_in_failed)).toBeVisible();

		server.on({ "POST /api/auth/session": apiError(400, "validation_failed", [{ path: "email", code: "email_invalid" }]) });
		await signIn();
		await expect.element(page.getByText(MESSAGES.en.validation.email_invalid)).toBeVisible();
	});

	it("leads to the setup while the instance has none", async () => {
		await renderForm({ "POST /api/auth/session": apiError(409, "setup_required") });

		await signIn();

		expect(loadPage).toHaveBeenCalledWith("/setup");
	});

	it("names Aegis and offers no reset until the instance is known", async () => {
		mockApi({ "GET /api/instance": "pending" });
		await renderUi(<SignInForm />);

		await expect.element(page.getByText("Sign in to manage Aegis.")).toBeVisible();
		await expect.element(page.getByRole("link", { name: MESSAGES.en.forgotPassword.title })).not.toBeInTheDocument();
	});
});
