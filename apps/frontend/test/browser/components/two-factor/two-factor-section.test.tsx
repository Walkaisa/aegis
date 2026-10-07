import type { TwoFactorStatusDto } from "@aegis/contracts";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { TwoFactorSection } from "@/components/two-factor/two-factor-section";
import { apiError, mockApi, type Route } from "../../../support/api";
import { me, RECOVERY_CODES, twoFactorSetup, twoFactorStatus } from "../../../support/fixtures";
import { pressOutside } from "../../../support/interactions";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.twoFactor;
const tCommon = MESSAGES.en.common;
const tValidation = MESSAGES.en.validation;

const OFF = twoFactorStatus({ enabled: false, enabledAt: null, label: null, recoveryCodesRemaining: 0 });
const ON = twoFactorStatus();

async function renderSection(status: TwoFactorStatusDto, routes: Record<string, Route> = {}) {
	const server = mockApi({ "GET /api/account/two-factor": { body: { twoFactor: status } }, ...routes });
	const screen = await renderUi(<TwoFactorSection />, { me: me({ twoFactorEnabled: status.enabled }) });
	await expect.element(page.getByText(status.enabled ? t.enabled : t.disabled, { exact: true })).toBeVisible();
	return { ...screen, server };
}

const dialog = () => page.getByRole("dialog");
const passwordField = () => dialog().getByLabelText(t.currentPassword, { exact: true });
const setupForm = () => dialog().element().querySelector("form") as HTMLFormElement;

async function openSetup() {
	await page.getByRole("button", { name: t.enable.action }).click();
	await expect.element(dialog().getByText(t.enable.steps["1"].title)).toBeVisible();
}

async function passPasswordStep() {
	await passwordField().fill("correct horse battery staple");
	await dialog().getByRole("button", { name: t.enable.continue }).click();
	await expect.element(dialog().getByText(t.enable.steps["2"].title)).toBeVisible();
}

describe("TwoFactorSection", () => {
	it("sets up an authenticator app in three steps", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		const { server, account } = await renderSection(OFF, {
			"POST /api/account/two-factor/setup": { body: twoFactorSetup() },
			"POST /api/account/two-factor": { body: { codes: RECOVERY_CODES, twoFactor: ON } },
		});
		await expect.element(page.getByText(t.disabledHint)).toBeVisible();

		await openSetup();
		await expect.element(dialog().getByText(translate("twoFactor.step", { step: 1, total: 3 }))).toBeVisible();
		await passPasswordStep();
		expect(server.calls("POST /api/account/two-factor/setup")[0]?.body).toEqual({ currentPassword: "correct horse battery staple" });

		await expect.element(dialog().getByRole("img", { name: t.enable.qrLabel })).toBeVisible();
		await expect.element(dialog().getByText("JBSW", { exact: true }).first()).toBeVisible();
		await expect.element(dialog().getByText("Example SSO")).toBeVisible();
		await dialog().getByRole("button", { name: t.enable.copyKey }).click();
		await dialog().getByLabelText(t.enable.labelTitle).fill("Bitwarden");
		await dialog().getByLabelText(t.enable.codeLabel).fill("123456");

		await expect.element(dialog().getByText(t.enable.steps["3"].title)).toBeVisible();
		expect(server.calls("POST /api/account/two-factor")[0]?.body).toEqual({ code: "123456", label: "Bitwarden" });
		await expect.element(page.getByText(t.enable.done)).toBeVisible();
		expect(account?.update).toHaveBeenCalledWith(
			expect.objectContaining({ account: expect.objectContaining({ twoFactorEnabled: true }) }),
		);

		// The codes stay until the user confirms they are stored.
		await userEvent.keyboard("{Escape}");
		await expect.element(dialog()).toBeVisible();
		const done = dialog().getByRole("button", { name: tCommon.done });
		await expect.element(done).toBeDisabled();
		await dialog().getByLabelText(t.recoveryCodes.confirm).click();
		await done.click();
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(page.getByText(t.enabled, { exact: true })).toBeVisible();
		await expect.element(page.getByText("1Password")).toBeVisible();
	});

	it("checks the password before it starts", async () => {
		const { server } = await renderSection(OFF, { "POST /api/account/two-factor/setup": apiError(400, "invalid_current_password") });
		await openSetup();

		await dialog().getByRole("button", { name: t.enable.continue }).click();
		await expect.element(dialog().getByText(tValidation.required)).toBeVisible();
		expect(server.calls("POST /api/account/two-factor/setup")).toEqual([]);

		await passwordField().fill("wrong");
		await dialog().getByRole("button", { name: t.enable.continue }).click();
		await expect.element(dialog().getByText(tValidation.current_password_invalid)).toBeVisible();

		server.on({
			"POST /api/account/two-factor/setup": apiError(400, "validation_failed", [{ path: "currentPassword", code: "too_long" }]),
		});
		await dialog().getByRole("button", { name: t.enable.continue }).click();
		await expect.element(dialog().getByText(tValidation.too_long)).toBeVisible();

		server.on({ "POST /api/account/two-factor/setup": apiError(429, "rate_limited") });
		await dialog().getByRole("button", { name: t.enable.continue }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.rate_limited)).toBeVisible();

		// Nothing was set up yet, so cancelling has nothing to discard.
		await dialog().getByRole("button", { name: tCommon.cancel }).click();
		await expect.element(dialog()).not.toBeInTheDocument();
		expect(server.calls("DELETE /api/account/two-factor/setup")).toEqual([]);
	});

	it("explains a wrong first code", async () => {
		const { server } = await renderSection(OFF, {
			"POST /api/account/two-factor/setup": { body: twoFactorSetup() },
			"POST /api/account/two-factor": apiError(400, "second_factor_invalid"),
		});
		await openSetup();
		await passPasswordStep();
		const code = dialog().getByLabelText(t.enable.codeLabel);
		const submit = dialog().getByRole("button", { name: new RegExp(t.enable.submit) });

		await expect.element(submit).toBeDisabled();
		await code.fill("111111");
		await expect.element(dialog().getByText(tValidation.second_factor_invalid)).toBeVisible();
		await expect.element(code).toHaveValue("");

		server.on({ "POST /api/account/two-factor": apiError(400, "validation_failed", [{ path: "label", code: "too_long" }]) });
		await code.fill("222222");
		await expect.element(dialog().getByText(tValidation.too_long)).toBeVisible();

		server.on({ "POST /api/account/two-factor": apiError(500, "internal_error") });
		await code.fill("333333");
		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();

		server.on({ "POST /api/account/two-factor": "pending" });
		await code.fill("444444");
		await expect.element(submit).toBeDisabled();
		setupForm().requestSubmit();
		expect(server.calls("POST /api/account/two-factor")).toHaveLength(4);
		// Nothing closes the dialog while the code is checked.
		await userEvent.keyboard("{Escape}");
		await pressOutside();
		await expect.element(dialog()).toBeVisible();
	});

	it("discards an unfinished setup when it is cancelled", async () => {
		const { server } = await renderSection(OFF, {
			"POST /api/account/two-factor/setup": { body: twoFactorSetup() },
			"DELETE /api/account/two-factor/setup": apiError(500, "internal_error"),
		});
		await openSetup();
		await passPasswordStep();

		await dialog().getByRole("button", { name: tCommon.cancel }).click();

		await expect.element(dialog()).not.toBeInTheDocument();
		expect(server.calls("DELETE /api/account/two-factor/setup")).toHaveLength(1);

		await openSetup();
		// A stray click next to the dialog must not throw the setup away.
		await pressOutside();
		await expect.element(dialog()).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(dialog()).not.toBeInTheDocument();
	});

	it("names an unnamed authenticator and warns when few recovery codes are left", async () => {
		await renderSection(twoFactorStatus({ label: null, enabledAt: null, recoveryCodesRemaining: 2 }));

		await expect.element(page.getByText(t.authenticator, { exact: true })).toBeVisible();
		await expect.element(page.getByText(t.disabledHint)).toBeVisible();
		await expect.element(page.getByText(translate("twoFactor.recoveryCodes.remaining", { count: 2, total: 10 }))).toBeVisible();
		await expect.element(page.getByText(t.recoveryCodes.low, { exact: false })).toBeVisible();
	});

	it("turns two-factor authentication off with password and code", async () => {
		const { server, account } = await renderSection(ON, {
			"POST /api/account/two-factor/disable": apiError(400, "invalid_current_password"),
		});
		await expect.element(page.getByText(/^On since/)).toBeVisible();
		await expect.element(page.getByText(t.recoveryCodes.low, { exact: false })).not.toBeInTheDocument();

		await page.getByRole("button", { name: t.disable.action }).click();
		await expect.element(dialog().getByText(t.disable.warningTitle)).toBeVisible();
		const submit = dialog().getByRole("button", { name: t.disable.submit });
		await submit.click();
		expect(dialog().getByText(tValidation.required).elements()).toHaveLength(2);

		await passwordField().fill("wrong");
		await dialog().getByLabelText(t.codeLabel).fill("123456");
		await submit.click();
		await expect.element(dialog().getByText(tValidation.current_password_invalid)).toBeVisible();

		server.on({ "POST /api/account/two-factor/disable": apiError(400, "second_factor_invalid") });
		await submit.click();
		await expect.element(dialog().getByText(tValidation.second_factor_invalid)).toBeVisible();
		await expect.element(dialog().getByLabelText(t.codeLabel)).toHaveValue("");

		server.on({ "POST /api/account/two-factor/disable": apiError(400, "validation_failed", [{ path: "code", code: "too_long" }]) });
		await dialog().getByLabelText(t.codeLabel).fill("123456");
		await submit.click();
		await expect.element(dialog().getByText(tValidation.too_long)).toBeVisible();

		server.on({ "POST /api/account/two-factor/disable": apiError(500, "internal_error") });
		await submit.click();
		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();

		server.on({ "POST /api/account/two-factor/disable": { body: { twoFactor: OFF } } });
		await submit.click();
		await expect.element(page.getByText(t.disable.done)).toBeVisible();
		await expect.element(dialog()).not.toBeInTheDocument();
		await expect.element(page.getByText(t.disabled, { exact: true })).toBeVisible();
		expect(account?.update).toHaveBeenCalledWith(
			expect.objectContaining({ account: expect.objectContaining({ twoFactorEnabled: false }) }),
		);
	});

	it("replaces the recovery codes and shows the new ones once", async () => {
		const { server, account } = await renderSection(ON, {
			"POST /api/account/two-factor/recovery-codes": { body: { codes: RECOVERY_CODES, twoFactor: ON } },
		});

		await page.getByRole("button", { name: t.regenerate.action }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(dialog()).not.toBeInTheDocument();

		await page.getByRole("button", { name: t.regenerate.action }).click();
		await expect.element(dialog().getByText(t.disable.warningTitle)).not.toBeInTheDocument();
		await passwordField().fill("correct horse battery staple");
		await dialog().getByLabelText(t.codeLabel).fill("123456");
		await dialog().getByRole("button", { name: t.regenerate.submit }).click();

		await expect.element(dialog().getByText(t.recoveryCodes.newTitle)).toBeVisible();
		await expect.element(page.getByText(t.regenerate.done)).toBeVisible();
		expect(server.calls("POST /api/account/two-factor/recovery-codes")[0]?.body).toEqual({
			currentPassword: "correct horse battery staple",
			code: "123456",
		});
		await userEvent.keyboard("{Escape}");
		await pressOutside();
		await expect.element(dialog()).toBeVisible();

		await dialog().getByLabelText(t.recoveryCodes.confirm).click();
		await dialog().getByRole("button", { name: tCommon.done }).click();
		await expect.element(dialog()).not.toBeInTheDocument();
		// The account already knows two-factor authentication is on.
		expect(account?.update).not.toHaveBeenCalled();
	});

	it("cancels turning it off, but not while the request runs", async () => {
		await renderSection(ON, { "POST /api/account/two-factor/disable": "pending" });

		await page.getByRole("button", { name: t.disable.action }).click();
		await dialog().getByRole("button", { name: tCommon.cancel }).click();
		await expect.element(dialog()).not.toBeInTheDocument();

		await page.getByRole("button", { name: t.disable.action }).click();
		await pressOutside();
		await expect.element(dialog()).not.toBeInTheDocument();

		await page.getByRole("button", { name: t.disable.action }).click();
		await passwordField().fill("correct horse battery staple");
		await dialog().getByLabelText(t.codeLabel).fill("123456");
		await dialog().getByRole("button", { name: t.disable.submit }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(dialog()).toBeVisible();
	});

	it("offers a retry when the status cannot be loaded", async () => {
		const server = mockApi({ "GET /api/account/two-factor": apiError(500, "internal_error") });
		await renderUi(<TwoFactorSection />, { me: me() });

		await expect.element(page.getByText(tCommon.loadFailed)).toBeVisible();
		server.on({ "GET /api/account/two-factor": { body: { twoFactor: OFF } } });
		await page.getByRole("button", { name: tCommon.retry }).click();
		await expect.element(page.getByText(t.disabled, { exact: true })).toBeVisible();
	});
});
