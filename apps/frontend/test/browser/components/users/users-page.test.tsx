import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { UsersPage } from "@/components/users/users-page";
import { apiError, mockApi } from "../../../support/api";
import { user } from "../../../support/fixtures";
import { router } from "../../../support/next/navigation";
import { MESSAGES, renderUi } from "../../../support/render";
import { GRACE } from "../../../support/users";

const t = MESSAGES.en;

describe("UsersPage", () => {
	it("lists the accounts and links to them", async () => {
		mockApi({ "GET /api/users": { body: { users: [user(), GRACE, user({ id: "3", displayName: "Old", enabled: false })] } } });
		await renderUi(<UsersPage />);

		await expect.element(page.getByRole("link", { name: /Grace Hopper/ }).first()).toBeVisible();
		await expect.element(page.getByText(t.users.neverSignedIn)).toBeVisible();
		await expect.element(page.getByText(t.accountStatus.disabled)).toBeVisible();
		await page
			.getByRole("link", { name: /Grace Hopper/ })
			.first()
			.click();
		expect(router.push).toHaveBeenLastCalledWith(`/users/${GRACE.id}`);

		await page.getByRole("button", { name: t.table.filters }).click();
		await page.getByRole("menuitemcheckbox", { name: t.roles.admin }).click();
		await page.getByRole("menuitemcheckbox", { name: t.accountStatus.disabled }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("link", { name: /Old/ }).first()).toBeVisible();
		await expect.element(page.getByRole("link", { name: /Grace Hopper/ })).not.toBeInTheDocument();
	});

	it("sorts and searches every column", async () => {
		mockApi({ "GET /api/users": { body: { users: [user({ avatarUrl: "/api/media/avatars/1/a.webp" }), GRACE] } } });
		await renderUi(<UsersPage />);
		await expect.element(page.getByRole("link", { name: /Grace Hopper/ }).first()).toBeVisible();

		await page.getByRole("button", { name: t.table.columns }).click();
		await page.getByRole("menuitemcheckbox", { name: t.users.columns.sessions }).click();
		await userEvent.keyboard("{Escape}");
		for (const column of ["role", "status", "email", "sessions", "createdAt", "lastSignIn"] as const) {
			await page.getByRole("button", { name: t.users.columns[column], exact: true }).click();
		}
		await page.getByRole("searchbox").fill("grace@");
		await expect.element(page.getByRole("link", { name: /Ada Lovelace/ })).not.toBeInTheDocument();
	});

	it("offers a retry when the accounts cannot be loaded", async () => {
		const server = mockApi({ "GET /api/users": apiError(500, "internal_error") });
		await renderUi(<UsersPage />);

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/users": { body: { users: [] } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.users.emptyTitle)).toBeVisible();
	});
});
