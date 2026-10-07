import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { SessionsPage } from "@/components/sessions/sessions-page";
import { loadPage } from "@/lib/browser";
import { apiError, mockApi } from "../../../support/api";
import { NOW, session } from "../../../support/fixtures";
import { router } from "../../../support/next/navigation";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.sessions;

const OWN = session({ id: "1", current: true, secondFactor: true });
const GRACE = session({
	id: "2",
	account: { id: "5", displayName: "Grace Hopper", email: "grace@example.com", role: "user", avatarUrl: null },
	userAgent:
		"Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
	ipAddress: null,
	applications: [
		{ id: "7", name: "Wiki", logoUrl: "/api/media/logos/7/a.webp", lastAuthorizedAt: NOW },
		{ id: "8", name: "Grafana", logoUrl: null, lastAuthorizedAt: NOW },
	],
});

describe("SessionsPage", () => {
	it("lists every session with the own one first", async () => {
		mockApi({ "GET /api/sessions": { body: { sessions: [GRACE, OWN] } } });
		await renderUi(<SessionsPage />);

		await expect.element(page.getByText(t.current).first()).toBeVisible();
		await expect.element(page.getByText(t.passwordOnly)).toBeVisible();
		await expect.element(page.getByRole("link", { name: /Wiki/ }).first()).toBeVisible();
		const rows = page.getByRole("row").elements();
		expect(rows[1]?.textContent).toContain("Ada Lovelace");

		for (const column of ["role", "device", "applications", "lastActive", "signIn", "account"] as const) {
			const header = page.getByRole("button", { name: t.columns[column], exact: true });
			if (header.query()) {
				await header.click();
			}
		}
		await page.getByRole("searchbox").fill("grafana");
		await expect.element(page.getByText("Ada Lovelace")).not.toBeInTheDocument();
		await page.getByRole("searchbox").fill("");
		await page.getByRole("button", { name: MESSAGES.en.table.filters }).click();
		await page.getByRole("menuitemcheckbox", { name: MESSAGES.en.roles.user }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("link", { name: "Ada Lovelace" })).not.toBeInTheDocument();
	});

	it("shows a session in the side panel and ends it", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		const server = mockApi({ "GET /api/sessions": { body: { sessions: [OWN, GRACE] } }, "DELETE /api/sessions/:id": { status: 204 } });
		await renderUi(<SessionsPage />);

		await page.getByRole("button", { name: MESSAGES.en.table.open }).nth(1).click();
		const panel = page.getByRole("dialog");
		await expect.element(panel.getByText(translate("sessions.panel.applications", { count: 2 }))).toBeVisible();
		await expect.element(panel.getByText("–")).toBeVisible();
		await panel.getByRole("link", { name: /Grafana/ }).click();
		expect(router.push).toHaveBeenLastCalledWith("/applications/8");

		await panel.getByRole("button", { name: t.panel.revoke }).click();
		await expect.element(page.getByText(translate("sessions.revokeDescription", { name: "Grace Hopper" }))).toBeVisible();
		await page.getByRole("alertdialog").getByRole("button", { name: t.revokeConfirm }).click();
		await expect.element(page.getByText(t.revoked)).toBeVisible();
		expect(server.calls("DELETE /api/sessions/:id")[0]?.params.id).toBe("2");
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
	});

	it("shows a session whose browser is unknown", async () => {
		mockApi({ "GET /api/sessions": { body: { sessions: [session({ id: "3", userAgent: null, ipAddress: null })] } } });
		await renderUi(<SessionsPage />);

		await page.getByRole("button", { name: MESSAGES.en.table.open }).first().click();

		await expect.element(page.getByRole("dialog").getByRole("heading", { name: MESSAGES.en.devices.unknown })).toBeVisible();
		await expect.element(page.getByRole("dialog").getByText("Mozilla", { exact: false })).not.toBeInTheDocument();
	});

	it("signs out after ending the own session or all sessions", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		mockApi({
			"GET /api/sessions": { body: { sessions: [OWN] } },
			"DELETE /api/sessions/:id": { status: 204 },
			"DELETE /api/sessions": { body: { revoked: 3 } },
		});
		await renderUi(<SessionsPage />);

		await page.getByRole("cell", { name: /Ada Lovelace/ }).click();
		await expect.element(page.getByRole("dialog").getByText(t.panel.account)).toBeVisible();
		await expect.element(page.getByRole("dialog").getByText(t.noApplications)).toBeVisible();
		await page.getByRole("dialog").getByRole("button", { name: MESSAGES.en.common.copy }).click();
		await page.getByRole("dialog").getByRole("button", { name: t.panel.revoke }).click();
		await expect.element(page.getByText(t.revokeCurrentDescription)).toBeVisible();
		await page.getByRole("alertdialog").getByRole("button", { name: t.revokeConfirm }).click();
		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledTimes(1));

		await userEvent.keyboard("{Escape}");
		await page.getByRole("button", { name: t.revokeAll }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.revokeAllConfirm }).click();
		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledTimes(2));
	});

	it("offers a retry when the sessions cannot be loaded", async () => {
		const server = mockApi({ "GET /api/sessions": apiError(500, "internal_error") });
		await renderUi(<SessionsPage />);

		await expect.element(page.getByText(MESSAGES.en.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/sessions": { body: { sessions: [] } } });
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();
		await expect.element(page.getByText(t.emptyTitle)).toBeVisible();
	});
});
