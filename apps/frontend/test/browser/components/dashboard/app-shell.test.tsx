import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { AppShell } from "@/components/dashboard/app-shell";
import { loadPage } from "@/lib/browser";
import { apiError, mockApi } from "../../../support/api";
import { me, versionStatus } from "../../../support/fixtures";
import { router, setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en;

describe("AppShell", () => {
	it("frames the administration once the session is known", async () => {
		mockApi({
			"GET /api/auth/session": { body: me() },
			"GET /api/settings/updates": {
				body: versionStatus({ updateAvailable: true, latest: { version: "1.3.0", url: "u", publishedAt: "2026-01-01T00:00:00Z" } }),
			},
			"DELETE /api/auth/session": { status: 204 },
		});
		setLocation("/users/new");
		await renderUi(<AppShell>content</AppShell>);

		await expect.element(page.getByText("content")).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.nav.users }).first()).toHaveAttribute("data-active", "true");
		await expect.element(page.getByText(t.breadcrumbs.newUser)).toBeVisible();
		await expect.element(page.getByRole("link", { name: /Update available|1\.3\.0/ }).first()).toBeVisible();
		await page.getByRole("link", { name: t.nav.sessions }).first().click();
		expect(router.push).toHaveBeenLastCalledWith("/sessions");

		await page.getByRole("button", { name: /Ada Lovelace/ }).click();
		await page.getByRole("menuitem", { name: t.nav.signOut }).click();
		await vi.waitFor(() => expect(loadPage).toHaveBeenCalledWith("/sign-in"));
	});

	it("waits for the session and offers a retry when it cannot be loaded", async () => {
		const server = mockApi({ "GET /api/auth/session": apiError(503, "setup_required") });
		await renderUi(<AppShell>content</AppShell>);

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/auth/session": apiError(401, "unauthorized") });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.common.loadFailed)).not.toBeInTheDocument();
		await expect.element(page.getByText("content")).not.toBeInTheDocument();
	});

	it("closes the navigation on phones and remembers a collapsed sidebar", async () => {
		await page.viewport(375, 800);
		try {
			// biome-ignore lint/suspicious/noDocumentCookie: the sidebar remembers its state in this cookie
			document.cookie = "sidebar_state=false; Path=/";
			mockApi({ "GET /api/auth/session": { body: me({ role: "user" }, "Example SSO") } });
			await renderUi(<AppShell>content</AppShell>);

			await page.getByRole("button", { name: "Toggle Sidebar" }).click();
			await expect.element(page.getByRole("dialog")).toBeVisible();
			await page.getByRole("dialog").getByRole("link", { name: t.nav.audit }).click();
			expect(router.push).toHaveBeenLastCalledWith("/audit");
			await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

			await page.getByRole("button", { name: "Toggle Sidebar" }).click();
			await page.getByRole("button", { name: /Ada Lovelace/ }).click();
			await page.getByRole("menuitem", { name: t.nav.account }).click();
			expect(router.push).toHaveBeenLastCalledWith("/settings/account");
		} finally {
			await page.viewport(1280, 800);
		}
	});
});
