import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { SecuritySettings } from "@/components/settings/security-settings";
import { apiError, mockApi } from "../../../support/api";
import { NOW, securityOverview } from "../../../support/fixtures";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en.settings;

describe("SecuritySettings", () => {
	it("shows the signing keys and rotates them", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		const rotated = securityOverview({
			signingKeys: [
				{ kid: "kid-new", alg: "RS256", status: "active", createdAt: NOW, retiredAt: null },
				{ kid: "kid-active", alg: "RS256", status: "retired", createdAt: NOW, retiredAt: NOW },
			],
		});
		mockApi({ "GET /api/settings/keys": { body: securityOverview() }, "POST /api/settings/keys/rotate": { body: rotated } });
		await renderUi(<SecuritySettings />);

		await expect.element(page.getByText("kid-active")).toBeVisible();
		await expect.element(page.getByText(/64 MiB, 3 iterations, parallelism 1/)).toBeVisible();
		await page.getByRole("button", { name: t.rotateKey }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.rotateKeyConfirm }).click();

		await expect.element(page.getByText(t.keyRotated)).toBeVisible();
		await expect.element(page.getByText(t.retired)).toBeVisible();
		await page.getByRole("button", { name: MESSAGES.en.common.copy }).first().click();
	});

	it("shows the safeguards while the keys load and offers a retry", async () => {
		const server = mockApi({ "GET /api/settings/keys": apiError(500, "internal_error") });
		await renderUi(<SecuritySettings />);

		await expect.element(page.getByText(/64 MiB, 3 iterations, parallelism 4/)).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/settings/keys": { body: securityOverview() } });
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();
		await expect.element(page.getByText("kid-active")).toBeVisible();
	});
});
