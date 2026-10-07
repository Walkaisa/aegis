import type { AccountResponse } from "@aegis/contracts";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { AccountSettings } from "@/components/settings/account-settings";
import { reloadPage } from "@/lib/browser";
import { apiError, mockApi, type Route } from "../../../support/api";
import { choose, imageFile } from "../../../support/files";
import { me, NOW, user } from "../../../support/fixtures";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.settings;

describe("AccountSettings", () => {
	const ADMIN = me({ lastSignInAt: null });
	const account = (overrides: Partial<AccountResponse> = {}): AccountResponse => ({
		account: ADMIN.account,
		pendingEmailChange: null,
		...overrides,
	});
	const TWO_FACTOR = { twoFactor: { enabled: false, enabledAt: null, label: null, recoveryCodesRemaining: 0 } };

	function routes(extra: Record<string, Route> = {}) {
		return { "GET /api/account": { body: account() }, "GET /api/account/two-factor": { body: TWO_FACTOR }, ...extra };
	}

	async function renderAccount(content: ReactNode = <AccountSettings />) {
		return renderUi(content, { me: ADMIN });
	}

	it("shows the account and saves a new name", async () => {
		const server = mockApi(
			routes({ "PUT /api/account": ({ body }) => ({ body: account({ account: { ...ADMIN.account, ...(body as object) } }) }) }),
		);
		const { account: context } = await renderAccount();

		await expect.element(page.getByText(t.never)).toBeVisible();
		const save = page.getByRole("button", { name: t.save });
		await expect.element(save).toBeDisabled();
		await page.getByLabelText(t.displayName).fill("Ada King");
		await save.click();

		await expect.element(page.getByText(t.profileSaved)).toBeVisible();
		expect(server.calls("PUT /api/account")[0]?.body).toEqual({ displayName: "Ada King", email: ADMIN.account.email });
		expect(context?.update).toHaveBeenCalledWith(
			expect.objectContaining({ account: expect.objectContaining({ displayName: "Ada King" }) }),
		);
	});

	it("changes the address with the password and manages the pending change", async () => {
		const pending = { email: "new@example.com", requestedAt: NOW, expiresAt: NOW };
		const server = mockApi(
			routes({
				"PUT /api/account": { body: account({ pendingEmailChange: pending }) },
				"POST /api/account/email-change/resend": { body: account({ pendingEmailChange: pending }) },
				"DELETE /api/account/email-change": { body: account() },
			}),
		);
		await renderAccount();

		await page.getByLabelText(t.email).fill("new@example.com");
		await page.getByLabelText(t.currentPassword, { exact: true }).first().fill("correct horse battery staple");
		await page.getByRole("button", { name: t.save }).click();

		await expect.element(page.getByText(translate("settings.emailChangeStarted", { email: "new@example.com" }))).toBeVisible();
		await expect.element(page.getByText(t.emailPending)).toBeVisible();
		expect(server.calls("PUT /api/account")[0]?.body).toMatchObject({ currentPassword: "correct horse battery staple" });

		await page.getByRole("button", { name: t.resendEmailChange }).click();
		await expect.element(page.getByText(t.emailChangeResent)).toBeVisible();
		await page.getByRole("button", { name: t.cancelEmailChange }).click();
		await expect.element(page.getByText(t.emailChangeCancelled)).toBeVisible();
		await expect.element(page.getByText(t.emailPending)).not.toBeInTheDocument();
	});

	it("reports what is wrong with a profile change", async () => {
		const pending = { email: "new@example.com", requestedAt: NOW, expiresAt: NOW };
		const server = mockApi(
			routes({
				"GET /api/account": { body: account({ pendingEmailChange: pending }) },
				"PUT /api/account": apiError(400, "invalid_current_password"),
				"POST /api/account/email-change/resend": apiError(503, "email_not_configured"),
			}),
		);
		await renderAccount();

		await page.getByRole("button", { name: t.resendEmailChange }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.email_not_configured)).toBeVisible();

		await page.getByLabelText(t.email).fill("taken@example.com");
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.required)).toBeVisible();

		await page.getByLabelText(t.currentPassword, { exact: true }).first().fill("wrong");
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.current_password_invalid)).toBeVisible();

		for (const [response, message] of [
			[apiError(409, "email_taken"), MESSAGES.en.validation.email_taken],
			[apiError(409, "email_change_pending"), MESSAGES.en.validation.email_change_pending],
			[apiError(400, "validation_failed", [{ path: "displayName", code: "too_long" }]), MESSAGES.en.validation.too_long],
			[apiError(500, "internal_error"), MESSAGES.en.errors.internal_error],
		] as const) {
			server.on({ "PUT /api/account": response });
			await page.getByRole("button", { name: t.save }).click();
			await expect.element(page.getByText(message).first()).toBeVisible();
		}
	});

	it("changes the password after checking the confirmation", async () => {
		const server = mockApi(routes({ "POST /api/account/password": { status: 204 } }));
		await renderAccount();

		await page.getByLabelText(t.currentPassword).fill("old password");
		await page.getByLabelText(t.newPassword).fill("a sufficiently long password");
		await page.getByLabelText(t.confirmPassword).fill("another password");
		await page.getByRole("button", { name: t.changePassword }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.password_mismatch)).toBeVisible();
		expect(server.calls("POST /api/account/password")).toEqual([]);

		await page.getByLabelText(t.confirmPassword).fill("a sufficiently long password");
		await page.getByRole("button", { name: t.changePassword }).click();
		await expect.element(page.getByText(t.passwordChanged)).toBeVisible();
		await expect.element(page.getByLabelText(t.newPassword)).toHaveValue("");
	});

	it("reports what is wrong with a password change", async () => {
		const server = mockApi(routes({ "POST /api/account/password": apiError(400, "invalid_current_password") }));
		await renderAccount();
		const fill = async () => {
			await page.getByLabelText(t.currentPassword).fill("old password");
			await page.getByLabelText(t.newPassword).fill("a sufficiently long password");
			await page.getByLabelText(t.confirmPassword).fill("a sufficiently long password");
		};

		await page.getByLabelText(t.newPassword).fill("short");
		await page.getByLabelText(t.confirmPassword).fill("short");
		await page.getByRole("button", { name: t.changePassword }).click();
		expect(server.calls("POST /api/account/password")).toEqual([]);

		await fill();
		await page.getByRole("button", { name: t.changePassword }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.current_password_invalid)).toBeVisible();

		server.on({
			"POST /api/account/password": apiError(400, "validation_failed", [{ path: "newPassword", code: "password_too_long" }]),
		});
		await page.getByRole("button", { name: t.changePassword }).click();
		await expect.element(page.getByText(/no more than/)).toBeVisible();

		server.on({ "POST /api/account/password": apiError(500, "internal_error") });
		await page.getByRole("button", { name: t.changePassword }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();
	});

	it("changes the picture, the language and the theme", async () => {
		mockApi(
			routes({
				"PUT /api/account/avatar": { body: account({ account: { ...ADMIN.account, avatarUrl: "/api/media/avatars/1/a.webp" } }) },
			}),
		);
		const { account: context } = await renderAccount();

		await page.getByRole("button", { name: MESSAGES.en.avatar.change }).click();
		await choose(await imageFile());
		await page.getByRole("button", { name: MESSAGES.en.avatar.save }).click();
		await vi.waitFor(() => expect(context?.update).toHaveBeenCalled());

		await expect.element(page.getByRole("combobox", { name: "" }).or(page.getByRole("combobox")).first()).toBeVisible();
		await page.getByRole("combobox").first().click();
		await page.getByRole("option", { name: "Deutsch" }).click();
		expect(reloadPage).toHaveBeenCalledOnce();

		await page.getByRole("radio", { name: MESSAGES.en.preferences.dark }).click();
		await expect.poll(() => document.documentElement.classList.contains("dark")).toBe(true);
	});

	it("removes the picture", async () => {
		mockApi(routes({ "DELETE /api/account/avatar": { body: account() } }));
		const admin = me({ avatarUrl: "/api/media/avatars/1/a.webp" });
		const { account: context } = await renderUi(<AccountSettings />, { me: admin });

		await page.getByRole("button", { name: MESSAGES.en.avatar.change }).click();
		await page.getByRole("menuitem", { name: MESSAGES.en.avatar.remove }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: MESSAGES.en.avatar.removeConfirm }).click();

		await vi.waitFor(() => expect(context?.update).toHaveBeenCalled());
		expect(user().avatarUrl).toBeNull();
	});
});
