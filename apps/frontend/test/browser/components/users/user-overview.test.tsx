import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { UserOverview } from "@/components/users/user-overview";
import { apiError } from "../../../support/api";
import { auditEvent, session } from "../../../support/fixtures";
import { MESSAGES } from "../../../support/render";
import { GRACE, renderAccount } from "../../../support/users";

const t = MESSAGES.en;

describe("UserOverview", () => {
	it("shows the latest activity and where the account is signed in", async () => {
		const older = { id: "7", name: "Wiki", logoUrl: null, lastAuthorizedAt: "2026-01-10T10:00:00.000Z" };
		const newer = { ...older, lastAuthorizedAt: "2026-01-14T10:00:00.000Z" };
		const grafana = { id: "8", name: "Grafana", logoUrl: null, lastAuthorizedAt: "2026-01-12T10:00:00.000Z" };
		await renderAccount(<UserOverview />, GRACE, {
			"GET /api/audit/events": { body: { events: [auditEvent("user.updated")], total: 1, page: 1, perPage: 8 } },
			"GET /api/users/:id/sessions": {
				body: {
					sessions: [
						session({ applications: [older, grafana] }),
						session({ id: "2", applications: [newer] }),
						session({ id: "3", applications: [older] }),
					],
				},
			},
		});

		// Newest sign-in first, each application once.
		const links = page.getByRole("link", { name: /Wiki|Grafana/ });
		await expect.poll(() => links.elements().length).toBe(2);
		await expect.element(links.nth(0)).toMatchTextContent(/Wiki/);
		await expect.element(links.nth(1)).toMatchTextContent(/Grafana/);
		await expect.element(page.getByText(t.userDetail.twoFactor.disabled)).toBeVisible();
	});

	it("offers retries when its parts cannot be loaded", async () => {
		const { server } = await renderAccount(
			<UserOverview />,
			{ ...GRACE, emailVerified: false, twoFactorEnabled: true },
			{
				"GET /api/audit/events": apiError(500, "internal_error"),
				"GET /api/users/:id/sessions": apiError(500, "internal_error"),
			},
		);

		await expect.poll(() => page.getByText(t.common.loadFailed).elements().length).toBe(2);
		await expect.element(page.getByText(t.userDetail.twoFactor.enabled)).toBeVisible();
		server.on({
			"GET /api/audit/events": { body: { events: [], total: 0, page: 1, perPage: 8 } },
			"GET /api/users/:id/sessions": { body: { sessions: [] } },
		});
		await page.getByRole("button", { name: t.common.retry }).nth(1).click();
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.userDetail.noActivity)).toBeVisible();
	});
});
