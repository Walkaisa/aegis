import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { UserLayout, useUser } from "@/components/users/user-layout";
import { UserOverview } from "@/components/users/user-overview";
import { apiError, mockApi } from "../../../support/api";
import { choose, imageFile } from "../../../support/files";
import { me, NOW, user } from "../../../support/fixtures";
import { setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi } from "../../../support/render";
import { GRACE, renderAccount } from "../../../support/users";

const t = MESSAGES.en;
const ADMIN = me();

describe("UserLayout", () => {
	it("names the account in the header, the breadcrumbs and the tabs", async () => {
		await renderAccount(
			<UserOverview />,
			GRACE,
			{
				"GET /api/audit/events": { body: { events: [], total: 0, page: 1, perPage: 8 } },
				"GET /api/users/:id/sessions": { body: { sessions: [] } },
			},
			"/sessions",
		);

		await expect.element(page.getByText("grace@example.com").first()).toBeVisible();
		await expect.element(page.getByRole("link", { name: ADMIN.instanceName })).toBeVisible();
		await expect.element(page.getByRole("link", { name: /Grace Hopper/ })).toBeVisible();
		await expect.element(page.getByRole("navigation", { name: "Grace Hopper" })).toBeVisible();
		await expect.element(page.getByText(t.userDetail.never)).toBeVisible();
		await expect.element(page.getByText(t.userDetail.noActivity)).toBeVisible();
		await expect.element(page.getByText(t.userDetail.noApplications)).toBeVisible();
	});

	it("changes the picture of another account without touching the own", async () => {
		const { account } = await renderAccount(<UserOverview />, GRACE, {
			"GET /api/audit/events": { body: { events: [], total: 0, page: 1, perPage: 8 } },
			"GET /api/users/:id/sessions": { body: { sessions: [] } },
			"PUT /api/users/:id/avatar": { body: { user: { ...GRACE, avatarUrl: "/api/media/avatars/2/new.webp" } } },
		});

		await page.getByRole("button", { name: t.avatar.change }).click();
		await choose(await imageFile());
		await page.getByRole("button", { name: t.avatar.save }).click();

		await expect.element(page.getByText(t.avatar.uploaded)).toBeVisible();
		expect(account?.update).not.toHaveBeenCalled();
	});

	it("tells when an account does not exist", async () => {
		mockApi({ "GET /api/users/:id": apiError(404, "not_found") });
		setLocation("/users/1");
		await renderUi(<UserLayout>tab</UserLayout>, { me: ADMIN });

		await expect.element(page.getByText(t.userDetail.notFoundTitle)).toBeVisible();
		await expect.element(page.getByText("tab")).not.toBeInTheDocument();
	});

	it("offers a retry when the account cannot be loaded", async () => {
		const server = mockApi({ "GET /api/users/:id": apiError(500, "internal_error") });
		setLocation(`/users/${GRACE.id}`);
		await renderUi(<UserLayout>tab</UserLayout>, { me: ADMIN });

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/users/:id": { body: { user: GRACE } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText("tab")).toBeVisible();
	});

	it("marks the own account and updates the sidebar with a new picture", async () => {
		const self = user({ id: ADMIN.account.id, lastSignInAt: NOW });
		const { account } = await renderAccount(<UserOverview />, self, {
			"GET /api/audit/events": { body: { events: [], total: 0, page: 1, perPage: 8 } },
			"GET /api/users/:id/sessions": { body: { sessions: [] } },
			"PUT /api/users/:id/avatar": { body: { user: { ...self, avatarUrl: "/api/media/avatars/1/new.webp" } } },
			"DELETE /api/users/:id/avatar": { body: { user: { ...self, avatarUrl: null } } },
		});

		await expect.element(page.getByText(t.userDetail.you)).toBeVisible();
		expect(account?.update).not.toHaveBeenCalled();

		await page.getByRole("button", { name: t.avatar.change }).click();
		await choose(await imageFile());
		await page.getByRole("button", { name: t.avatar.save }).click();
		await expect.element(page.getByText(t.avatar.uploaded)).toBeVisible();
		expect(account?.update).toHaveBeenLastCalledWith(
			expect.objectContaining({ account: expect.objectContaining({ avatarUrl: "/api/media/avatars/1/new.webp" }) }),
		);

		await page.getByRole("button", { name: t.avatar.change }).click();
		await page.getByRole("menuitem", { name: t.avatar.remove }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.avatar.removeConfirm }).click();
		await expect.element(page.getByText(t.avatar.removed)).toBeVisible();
		expect(account?.update).toHaveBeenCalledTimes(2);
	});

	it("needs to wrap the tabs", async () => {
		function Tab() {
			useUser();
			return null;
		}
		vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(renderUi(<Tab />, { me: ADMIN })).rejects.toThrow("useUser must be used inside <UserLayout>");
	});
});
