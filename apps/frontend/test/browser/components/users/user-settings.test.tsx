import { PASSWORD_MIN_LENGTH } from "@aegis/contracts";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { UserSettings } from "@/components/users/user-settings";
import { loadPage } from "@/lib/browser";
import { apiError } from "../../../support/api";
import { me, NOW, user } from "../../../support/fixtures";
import { pressOutside } from "../../../support/interactions";
import { router } from "../../../support/next/navigation";
import { MESSAGES, translate } from "../../../support/render";
import { GRACE, renderAccount } from "../../../support/users";

const t = MESSAGES.en;
const ADMIN = me();

describe("UserSettings", () => {
	it("saves the profile and reports errors", async () => {
		const { server } = await renderAccount(<UserSettings />, GRACE, {
			"PUT /api/users/:id": ({ body }) => ({ body: { user: { ...GRACE, ...(body as object), updatedAt: NOW } } }),
		});

		const save = page.getByRole("button", { name: t.userDetail.save });
		await expect.element(save).toBeDisabled();
		await page.getByLabelText(t.userDetail.displayName).fill("Grace B. Hopper");
		await page.getByRole("switch", { name: t.userDetail.emailVerified }).click();
		await save.click();
		await expect.element(page.getByText(t.userDetail.saved)).toBeVisible();
		expect(server.calls("PUT /api/users/:id")[0]?.body).toEqual({
			displayName: "Grace B. Hopper",
			email: GRACE.email,
			role: "user",
			emailVerified: false,
		});

		await page.getByLabelText(t.userDetail.email).fill("not an address");
		await page.getByRole("button", { name: t.userDetail.save }).click();
		await expect.element(page.getByText(t.validation.email_invalid)).toBeVisible();

		for (const [response, message] of [
			[apiError(409, "email_taken"), t.validation.email_taken],
			[apiError(400, "validation_failed", [{ path: "displayName", code: "too_long" }]), t.validation.too_long],
			[apiError(500, "internal_error"), t.errors.internal_error],
		] as const) {
			server.on({ "PUT /api/users/:id": response });
			await page.getByLabelText(t.userDetail.email).fill(`grace${Math.random()}@example.com`);
			await page.getByRole("button", { name: t.userDetail.save }).click();
			await expect.element(page.getByText(message).first()).toBeVisible();
		}
	});

	it("changes the role, and signs the own account out after it", async () => {
		const { server } = await renderAccount(<UserSettings />, GRACE, {
			"PUT /api/users/:id": ({ body }) => ({ body: { user: { ...GRACE, ...(body as object), updatedAt: NOW } } }),
		});

		await page.getByRole("radio", { name: new RegExp(t.roles.admin) }).click();
		await expect.element(page.getByText(t.userDetail.roleChangeWarning)).toBeVisible();
		await page.getByRole("button", { name: t.userDetail.changeRole }).click();
		await expect.element(page.getByText(t.userDetail.saved)).toBeVisible();
		expect(server.calls("PUT /api/users/:id")[0]?.body).toMatchObject({ role: "admin" });

		server.on({ "PUT /api/users/:id": apiError(500, "internal_error") });
		await page.getByRole("radio", { name: new RegExp(t.roles.user) }).click();
		await page.getByRole("button", { name: t.userDetail.changeRole }).click();
		await expect.element(page.getByText(t.errors.internal_error)).toBeVisible();
	});

	it("signs the own account out after changing its role", async () => {
		const self = user({ id: ADMIN.account.id });
		await renderAccount(<UserSettings />, self, { "PUT /api/users/:id": { body: { user: { ...self, role: "user" } } } });

		await page.getByRole("radio", { name: new RegExp(t.roles.user) }).click();
		await expect.element(page.getByText(t.userDetail.roleChangeSelfWarning)).toBeVisible();
		await page.getByRole("button", { name: t.userDetail.changeRole }).click();

		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith("/sign-in"));
	});

	it("keeps the last active admin", async () => {
		await renderAccount(<UserSettings />, user({ isLastActiveAdmin: true }));

		await expect.element(page.getByText(t.userDetail.lastAdmin.role)).toBeVisible();
		await expect.element(page.getByText(t.userDetail.lastAdmin.disable)).toBeVisible();
		await expect.element(page.getByText(t.userDetail.lastAdmin.delete)).toBeVisible();
		await expect.element(page.getByRole("button", { name: t.userDetail.disable })).toBeDisabled();
		await expect.element(page.getByRole("button", { name: t.userDetail.delete })).toBeDisabled();
	});

	it("disables and enables an account", async () => {
		await renderAccount(<UserSettings />, GRACE, {
			"POST /api/users/:id/disable": { body: { user: { ...GRACE, enabled: false } } },
			"POST /api/users/:id/enable": { body: { user: GRACE } },
		});

		await page.getByRole("button", { name: t.userDetail.disable }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.disableConfirm }).click();
		await expect.element(page.getByText(t.userDetail.disabledToast)).toBeVisible();
		await expect.element(page.getByText(t.userDetail.statusDisabledDescription).first()).toBeVisible();

		await page.getByRole("button", { name: t.userDetail.enable }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.enable }).click();
		await expect.element(page.getByText(t.userDetail.enabledToast)).toBeVisible();
	});

	it("signs out after disabling the own account", async () => {
		const self = user({ id: ADMIN.account.id });
		await renderAccount(<UserSettings />, self, { "POST /api/users/:id/disable": { body: { user: { ...self, enabled: false } } } });

		await page.getByRole("button", { name: t.userDetail.disable }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.disableConfirm }).click();

		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith("/sign-in"));
	});

	it("resets the password to a generated one", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		await renderAccount(<UserSettings />, GRACE, {
			"POST /api/users/:id/password": { body: { user: GRACE, generatedPassword: "generated-password-123456" } },
		});

		await page.getByRole("button", { name: t.userDetail.resetPassword }).click();
		await page.getByRole("dialog").getByRole("button", { name: t.userDetail.resetSubmit }).click();

		await expect.element(page.getByText(t.userDetail.generatedWarningTitle)).toBeVisible();
		await expect.element(page.getByRole("dialog").getByRole("textbox")).toHaveValue("generated-password-123456");
		await userEvent.keyboard("{Escape}");
		await pressOutside();
		await expect.element(page.getByRole("dialog")).toBeVisible();
		await page.getByRole("button", { name: t.common.done }).click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	it("resets the password to a chosen one and checks it first", async () => {
		const { server } = await renderAccount(<UserSettings />, GRACE, {
			"POST /api/users/:id/password": apiError(400, "validation_failed", [{ path: "password", code: "password_too_short" }]),
		});

		await page.getByRole("button", { name: t.userDetail.resetPassword }).click();
		await page.getByRole("radio", { name: new RegExp(t.userDetail.resetModes.manual.title) }).click();
		await page.getByRole("dialog").getByRole("button", { name: t.userDetail.resetSubmit }).click();
		await expect.element(page.getByText(translate("validation.password_too_short", { min: PASSWORD_MIN_LENGTH }))).toBeVisible();
		expect(server.calls("POST /api/users/:id/password")).toEqual([]);

		await page.getByLabelText(t.userDetail.newPassword).fill("a sufficiently long password");
		await page.getByRole("dialog").getByRole("button", { name: t.userDetail.resetSubmit }).click();
		await expect.element(page.getByText(translate("validation.password_too_short", { min: PASSWORD_MIN_LENGTH }))).toBeVisible();

		server.on({ "POST /api/users/:id/password": apiError(500, "internal_error") });
		await page.getByRole("dialog").getByRole("button", { name: t.userDetail.resetSubmit }).click();
		await expect.element(page.getByText(t.errors.internal_error)).toBeVisible();

		server.on({ "POST /api/users/:id/password": { body: { user: GRACE, generatedPassword: null } } });
		await page.getByRole("dialog").getByRole("button", { name: t.userDetail.resetSubmit }).click();
		await expect.element(page.getByText(t.userDetail.resetDone)).toBeVisible();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

		await page.getByRole("button", { name: t.userDetail.resetPassword }).click();
		await page.getByRole("dialog").getByRole("button", { name: t.common.cancel }).click();
		await page.getByRole("button", { name: t.userDetail.resetPassword }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	it("signs out after resetting the own password", async () => {
		const self = user({ id: ADMIN.account.id });
		await renderAccount(<UserSettings />, self, { "POST /api/users/:id/password": { body: { user: self, generatedPassword: null } } });

		await page.getByRole("button", { name: t.userDetail.resetPassword }).click();
		await page.getByRole("radio", { name: new RegExp(t.userDetail.resetModes.manual.title) }).click();
		await page.getByLabelText(t.userDetail.newPassword).fill("a sufficiently long password");
		await page.getByRole("dialog").getByRole("button", { name: t.userDetail.resetSubmit }).click();

		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith("/sign-in"));
	});

	it("resets the two-factor authentication of another account", async () => {
		await renderAccount(
			<UserSettings />,
			{ ...GRACE, twoFactorEnabled: true },
			{ "DELETE /api/users/:id/two-factor": { body: { user: GRACE } } },
		);

		await expect.element(page.getByText(t.userDetail.twoFactor.enabledHint)).toBeVisible();
		await page.getByRole("button", { name: t.userDetail.twoFactor.reset }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.twoFactor.resetConfirm }).click();

		await expect.element(page.getByText(translate("userDetail.twoFactor.resetDone", { name: "Grace Hopper" }))).toBeVisible();
		await expect.element(page.getByText(t.userDetail.twoFactor.disabledHint)).toBeVisible();
	});

	it("sends admins to their own account for their own second factor", async () => {
		await renderAccount(<UserSettings />, user({ id: ADMIN.account.id }));

		await expect.element(page.getByText(t.userDetail.twoFactor.disabledSelfHint)).toBeVisible();
		await expect
			.element(page.getByRole("link", { name: t.userDetail.twoFactor.manageOwn }))
			.toHaveAttribute("href", "/settings/account#two-factor");
	});

	it("deletes an account", async () => {
		// The list the browser returns to; the test router keeps the account page mounted.
		await renderAccount(<UserSettings />, GRACE, {
			"DELETE /api/users/:id": { status: 204 },
			"GET /api/users/": apiError(404, "not_found"),
		});

		await page.getByRole("button", { name: t.userDetail.delete }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.deleteConfirm }).click();

		await expect.element(page.getByText(translate("userDetail.deleted", { name: "Grace Hopper" }))).toBeVisible();
		expect(router.push).toHaveBeenLastCalledWith("/users");
	});

	it("signs out after deleting the own account", async () => {
		await renderAccount(<UserSettings />, user({ id: ADMIN.account.id }), { "DELETE /api/users/:id": { status: 204 } });

		await page.getByRole("button", { name: t.userDetail.delete }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.deleteConfirm }).click();

		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith("/sign-in"));
	});

	it("keeps a confirmation open when the action fails", async () => {
		await renderAccount(<UserSettings />, GRACE, { "DELETE /api/users/:id": apiError(409, "last_active_admin") });

		await page.getByRole("button", { name: t.userDetail.delete }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.deleteConfirm }).click();

		await expect.element(page.getByText(t.errors.last_active_admin)).toBeVisible();
		await expect.element(page.getByRole("alertdialog")).toBeVisible();
		await page.getByRole("alertdialog").getByRole("button", { name: t.common.cancel }).click();
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
	});
});
