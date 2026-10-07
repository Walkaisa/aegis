import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApplicationsPage } from "@/components/applications/applications-page";
import { apiError, mockApi } from "../../../support/api";
import { NATIVE, SPA, WIKI } from "../../../support/applications";
import { router } from "../../../support/next/navigation";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en;

describe("ApplicationsPage", () => {
	it("lists, filters and sorts the applications", async () => {
		mockApi({ "GET /api/applications": { body: { clients: [WIKI, SPA, NATIVE] } } });
		await renderUi(<ApplicationsPage />);

		await expect.element(page.getByRole("link", { name: /Dashboard/ }).first()).toBeVisible();
		await expect.element(page.getByText(t.applications.neverUsed).first()).toBeVisible();
		await expect.element(page.getByText(translate("applications.access.assigned", { count: 2 }))).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.applications.new })).toBeVisible();

		await page.getByRole("button", { name: t.table.columns }).click();
		await page.getByRole("menuitemcheckbox", { name: t.applications.columns.clientId }).click();
		await page.getByRole("menuitemcheckbox", { name: t.applications.columns.createdAt }).click();
		await userEvent.keyboard("{Escape}");
		for (const column of ["status", "clientId", "kind", "access", "sessions", "lastUsedColumn", "createdAt", "application"] as const) {
			const header = page.getByRole("button", { name: t.applications.columns[column], exact: true });
			if (header.query()) {
				await header.click();
			}
		}
		await page.getByRole("button", { name: t.table.filters }).click();
		await page.getByRole("menuitemcheckbox", { name: t.applicationKinds.native.title }).click();
		await page.getByRole("menuitemcheckbox", { name: t.applicationKinds.spa.title }).click();
		await page.getByRole("menuitemcheckbox", { name: t.accountStatus.enabled }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("link", { name: /Wiki/ })).not.toBeInTheDocument();
		await expect.element(page.getByRole("link", { name: /Dashboard/ })).not.toBeInTheDocument();
		await page
			.getByRole("link", { name: /Mobile/ })
			.first()
			.click();
		expect(router.push).toHaveBeenLastCalledWith(`/applications/${NATIVE.id}`);
	});

	it("starts with a choice of kinds", async () => {
		mockApi({ "GET /api/applications": { body: { clients: [] } } });
		await renderUi(<ApplicationsPage />);

		await expect.element(page.getByText(t.applications.emptyTitle)).toBeVisible();
		await page.getByRole("link", { name: new RegExp(t.applicationKinds.spa.title) }).click();
		expect(router.push).toHaveBeenLastCalledWith("/applications/new?kind=spa");
	});

	it("offers a retry when the applications cannot be loaded", async () => {
		const server = mockApi({ "GET /api/applications": apiError(500, "internal_error") });
		await renderUi(<ApplicationsPage />);

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/applications": { body: { clients: [WIKI] } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByRole("link", { name: /Wiki/ }).first()).toBeVisible();
	});
});
