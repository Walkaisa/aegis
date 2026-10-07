import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { GeneralSettings } from "@/components/settings/general-settings";
import { apiError, mockApi } from "../../../support/api";
import { me, NOW } from "../../../support/fixtures";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.settings;

const INSTANCE = {
	instanceName: "Example SSO",
	sessionTtlDays: 30,
	auditRetentionDays: 90,
	issuer: "https://auth.example.com",
	setupCompletedAt: NOW,
};

describe("GeneralSettings", () => {
	it("saves the instance settings and renames the instance", async () => {
		const server = mockApi({
			"GET /api/settings": { body: INSTANCE },
			"PATCH /api/settings": ({ body }) => ({ body: { ...INSTANCE, ...(body as object) } }),
		});
		const { account } = await renderUi(<GeneralSettings />, { me: me() });

		await page.getByLabelText(t.instanceName).fill("Team SSO");
		await page.getByLabelText(t.sessionTtl).fill("14");
		await page.getByLabelText(t.auditRetention).fill("30");
		await page.getByRole("button", { name: t.save }).click();

		await expect.element(page.getByText(t.instanceSaved)).toBeVisible();
		expect(server.calls("PATCH /api/settings")[0]?.body).toEqual({
			instanceName: "Team SSO",
			sessionTtlDays: 14,
			auditRetentionDays: 30,
		});
		expect(account?.update).toHaveBeenCalledWith(expect.objectContaining({ instanceName: "Team SSO" }));
	});

	it("checks the values and reports errors", async () => {
		const server = mockApi({
			"GET /api/settings": { body: INSTANCE },
			"PATCH /api/settings": apiError(400, "validation_failed", [{ path: "instanceName", code: "too_long" }]),
		});
		await renderUi(<GeneralSettings />, { me: me() });

		await page.getByLabelText(t.sessionTtl).fill("");
		await page.getByLabelText(t.auditRetention).fill("0");
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.invalid).first()).toBeVisible();
		await expect.element(page.getByLabelText(t.auditRetention)).toHaveAttribute("aria-invalid", "true");
		expect(server.calls("PATCH /api/settings")).toEqual([]);

		await page.getByLabelText(t.sessionTtl).fill("30");
		await page.getByLabelText(t.auditRetention).fill("90");
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(MESSAGES.en.validation.too_long)).toBeVisible();

		server.on({ "PATCH /api/settings": apiError(500, "internal_error") });
		await page.getByRole("button", { name: t.save }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.internal_error)).toBeVisible();
	});

	it("offers a retry when the settings cannot be loaded", async () => {
		const server = mockApi({ "GET /api/settings": apiError(500, "internal_error") });
		await renderUi(<GeneralSettings />, { me: me() });

		await expect.element(page.getByText(MESSAGES.en.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/settings": { body: INSTANCE } });
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();
		await expect.element(page.getByLabelText(t.instanceName)).toHaveValue("Example SSO");
	});
});
