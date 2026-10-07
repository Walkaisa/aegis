import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApplicationSessions } from "@/components/applications/client-sessions";
import { apiError } from "../../../support/api";
import { renderApplication, WIKI } from "../../../support/applications";
import { clientSession } from "../../../support/fixtures";
import { MESSAGES, translate } from "../../../support/render";

const t = MESSAGES.en;

describe("ApplicationSessions", () => {
	it("lists the sign-ins of the application and ends them", async () => {
		const sessions = [
			clientSession(),
			clientSession({ sessionId: "2", ipAddress: null, account: { ...clientSession().account, id: "5", displayName: "Grace" } }),
		];
		const { server } = await renderApplication(<ApplicationSessions />, WIKI, {
			"GET /api/applications/:id/sessions": { body: { sessions } },
			"DELETE /api/applications/:id/sessions/:sessionId": { status: 204 },
			"DELETE /api/applications/:id/sessions": { status: 204 },
		});

		await expect.element(page.getByRole("link", { name: "Grace" })).toBeVisible();
		await page.getByRole("button", { name: t.table.columns }).click();
		await page.getByRole("menuitemcheckbox", { name: t.clientSessions.columns.expiresAt }).click();
		await userEvent.keyboard("{Escape}");
		for (const column of ["account", "device", "lastSignIn", "firstSignIn", "expiresAt"] as const) {
			await page.getByRole("button", { name: t.clientSessions.columns[column], exact: true }).click();
		}

		await page.getByRole("button", { name: t.clientSessions.revoke, exact: true }).first().click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.clientSessions.revokeConfirm }).click();
		await expect.element(page.getByText(/Session of .* ended\./)).toBeVisible();
		expect(server.calls("DELETE /api/applications/:id/sessions/:sessionId")).toHaveLength(1);

		await page.getByRole("button", { name: t.clientSessions.revokeAll }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.clientSessions.revokeAllConfirm }).click();
		await expect.element(page.getByText(translate("clientSessions.revoked", { name: "Wiki" }))).toBeVisible();
	});

	it("offers a retry when the sessions cannot be loaded", async () => {
		const { server } = await renderApplication(<ApplicationSessions />, WIKI, {
			"GET /api/applications/:id/sessions": apiError(500, "internal_error"),
		});

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/applications/:id/sessions": { body: { sessions: [] } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.clientSessions.emptyTitle)).toBeVisible();
	});
});
