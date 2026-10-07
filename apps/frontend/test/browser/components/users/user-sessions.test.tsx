import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { UserSessions } from "@/components/users/user-sessions";
import { loadPage } from "@/lib/browser";
import { apiError } from "../../../support/api";
import { me, NOW, session, user } from "../../../support/fixtures";
import { MESSAGES, translate } from "../../../support/render";
import { GRACE, renderAccount } from "../../../support/users";

const t = MESSAGES.en;
const ADMIN = me();

describe("UserSessions", () => {
	const sessions = [
		session({ id: "11", secondFactor: true, applications: [{ id: "7", name: "Wiki", logoUrl: null, lastAuthorizedAt: NOW }] }),
		session({ id: "12", ipAddress: null, userAgent: null, account: { ...session().account, displayName: "Grace Hopper" } }),
	];

	it("lists the sessions of an account and ends them", async () => {
		const { server } = await renderAccount(<UserSessions />, GRACE, {
			"GET /api/users/:id/sessions": { body: { sessions } },
			"DELETE /api/sessions/:id": { status: 204 },
			"DELETE /api/users/:id/sessions": { body: { revoked: 2 } },
		});

		await expect.element(page.getByRole("link", { name: "Wiki" }).first()).toBeVisible();
		await expect.element(page.getByText(t.sessions.secondFactor).first()).toBeVisible();
		await expect.element(page.getByText(t.devices.unknown).first()).toBeVisible();
		for (const column of ["device", "applications", "lastActive", "expiresAt"] as const) {
			await page.getByRole("button", { name: t.sessions.columns[column], exact: true }).click();
		}
		await page.getByRole("searchbox").fill("wiki");
		await expect.element(page.getByText(t.devices.unknown)).not.toBeInTheDocument();
		await page.getByRole("searchbox").fill("");

		await page.getByRole("table").getByRole("button", { name: t.sessions.revoke, exact: true }).nth(1).click();
		await expect.element(page.getByText(translate("sessions.revokeDescription", { name: "Grace Hopper" }))).toBeVisible();
		await page.getByRole("alertdialog").getByRole("button", { name: t.sessions.revokeConfirm }).click();
		await expect.element(page.getByText(t.sessions.revoked)).toBeVisible();
		expect(server.calls("DELETE /api/sessions/:id")).toHaveLength(1);

		await page.getByRole("button", { name: t.userDetail.sessionsTab.revokeAll }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.sessionsTab.revokeAllConfirm }).click();
		await expect.element(page.getByText(translate("userDetail.sessionsTab.revokedAll", { count: 2 }))).toBeVisible();
	});

	it("signs out when the own sessions end", async () => {
		const self = user({ id: ADMIN.account.id });
		await renderAccount(<UserSessions />, self, {
			"GET /api/users/:id/sessions": { body: { sessions: [session({ current: true })] } },
			"DELETE /api/sessions/:id": { status: 204 },
			"DELETE /api/users/:id/sessions": { body: { revoked: 1 } },
		});

		await expect.element(page.getByText(t.sessions.current).first()).toBeVisible();
		// The card the list shows on small screens.
		await page.getByRole("listitem").getByRole("button", { name: t.sessions.revoke, exact: true }).click();
		await expect.element(page.getByText(t.sessions.revokeCurrentDescription)).toBeVisible();
		await page.getByRole("alertdialog").getByRole("button", { name: t.sessions.revokeConfirm }).click();
		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledTimes(1));

		await page.getByRole("button", { name: t.userDetail.sessionsTab.revokeAll }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.userDetail.sessionsTab.revokeAllConfirm }).click();
		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledTimes(2));
	});

	it("shows an empty list and load errors", async () => {
		const { server } = await renderAccount(<UserSessions />, GRACE, { "GET /api/users/:id/sessions": apiError(500, "internal_error") });

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/users/:id/sessions": { body: { sessions: [] } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.userDetail.sessionsTab.emptyTitle)).toBeVisible();
		await expect.element(page.getByRole("button", { name: t.userDetail.sessionsTab.revokeAll })).not.toBeInTheDocument();
	});
});
