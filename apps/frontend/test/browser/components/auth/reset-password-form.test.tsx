import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { reloadPage } from "@/lib/browser";
import { apiError, mockApi, type Route } from "../../../support/api";
import { instanceInfo, NOW } from "../../../support/fixtures";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.resetPassword;
const LINK = { maskedEmail: "a**@example.com", displayName: "Ada Lovelace", expiresAt: NOW };
const PASSWORD = "a sufficiently long password";

/** Opens the reset page from the link in the e-mail, which carries the token in its fragment. */
async function openLink(token: string, routes: Record<string, Route>) {
	window.history.replaceState(null, "", `/reset-password#token=${token}`);
	const server = mockApi({ "GET /api/instance": { body: instanceInfo() }, ...routes });
	const screen = await renderUi(<ResetPasswordForm />);
	return { ...screen, server };
}

describe("ResetPasswordForm", () => {
	it("checks the link, then sets the new password", async () => {
		const { server } = await openLink("valid-token", {
			"POST /api/auth/password-reset/validate": { body: LINK },
			"POST /api/auth/password-reset/confirm": { status: 204 },
		});

		await expect.element(page.getByText("for a**@example.com")).toBeVisible();
		await expect.element(page.getByText(/^This link expires on Jan 15, 2026/)).toBeVisible();
		expect(server.calls("POST /api/auth/password-reset/validate")[0]?.body).toEqual({ token: "valid-token" });

		await page.getByLabelText(t.newPassword, { exact: true }).fill(PASSWORD);
		await page.getByLabelText(t.confirmPassword, { exact: true }).fill(PASSWORD);
		await page.getByRole("button", { name: t.submit }).click();

		await expect.element(page.getByText(t.successTitle)).toBeVisible();
		expect(server.calls("POST /api/auth/password-reset/confirm")[0]?.body).toEqual({ token: "valid-token", password: PASSWORD });
		await expect.element(page.getByRole("link", { name: t.signIn })).toHaveAttribute("href", "/sign-in");
	});

	it("checks the new password and reports failures", async () => {
		const { server } = await openLink("valid-token", {
			"POST /api/auth/password-reset/validate": { body: LINK },
			"POST /api/auth/password-reset/confirm": apiError(400, "validation_failed", [{ path: "password", code: "password_too_short" }]),
		});
		const submit = page.getByRole("button", { name: t.submit });

		await page.getByLabelText(t.newPassword, { exact: true }).fill(PASSWORD);
		await page.getByLabelText(t.confirmPassword, { exact: true }).fill("something else");
		await submit.click();
		await expect.element(page.getByText(MESSAGES.en.validation.password_mismatch)).toBeVisible();

		await page.getByLabelText(t.newPassword, { exact: true }).fill("short");
		await page.getByLabelText(t.confirmPassword, { exact: true }).fill("short");
		await submit.click();
		expect(server.calls("POST /api/auth/password-reset/confirm")).toEqual([]);

		await page.getByLabelText(t.newPassword, { exact: true }).fill(PASSWORD);
		await page.getByLabelText(t.confirmPassword, { exact: true }).fill(PASSWORD);
		await submit.click();
		await expect.element(page.getByText(/at least/)).toBeVisible();

		server.on({ "POST /api/auth/password-reset/confirm": apiError(500, "internal_error") });
		await submit.click();
		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();
	});

	it("says when a link no longer works", async () => {
		await openLink("used-token", { "POST /api/auth/password-reset/validate": apiError(400, "verification_token_invalid") });

		await expect.element(page.getByText(t.invalidTitle)).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.request })).toHaveAttribute("href", "/forgot-password");
	});

	it("rejects a malformed link without asking the server", async () => {
		const { server } = await openLink("not/a/token", {});

		await expect.element(page.getByText(t.invalidTitle)).toBeVisible();
		expect(server.calls("POST /api/auth/password-reset/validate")).toEqual([]);
	});

	it("rejects a link without a token", async () => {
		window.history.replaceState(null, "", "/reset-password");
		mockApi({ "GET /api/instance": "pending" });
		await renderUi(<ResetPasswordForm />);

		await expect.element(page.getByText(t.invalidTitle)).toBeVisible();
	});

	it("offers a retry when the link cannot be checked", async () => {
		await openLink("valid-token", { "POST /api/auth/password-reset/validate": "network-error" });

		await expect.element(page.getByText(MESSAGES.en.errors.network_error)).toBeVisible();
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();
		expect(reloadPage).toHaveBeenCalledOnce();
	});

	it("shows that the link is being checked", async () => {
		await openLink("valid-token", { "POST /api/auth/password-reset/validate": "pending" });

		await expect.element(page.getByText(t.checking)).toBeVisible();
	});
	it.each([
		["valid", { body: LINK }],
		["rejected", apiError(400, "verification_token_invalid")],
	] as const)("ignores a %s check that answers after the page was left", async (_outcome, answer) => {
		let respond = () => {};
		const answered = new Promise<void>((resolve) => {
			respond = resolve;
		});
		const { server, unmount } = await openLink("valid-token", {
			"POST /api/auth/password-reset/validate": async () => {
				await answered;
				return answer;
			},
		});
		await vi.waitFor(() => expect(server.calls("POST /api/auth/password-reset/validate")).toHaveLength(1));

		await unmount();
		respond();

		await expect.poll(() => document.body.textContent).not.toContain(t.invalidTitle);
	});
});
