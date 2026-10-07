import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { ApplicationLayout, useApplication } from "@/components/applications/application-layout";
import { ApplicationSessions } from "@/components/applications/client-sessions";
import { apiError, mockApi } from "../../../support/api";
import { renderApplication, SPA, WIKI } from "../../../support/applications";
import { choose, imageFile } from "../../../support/files";
import { me } from "../../../support/fixtures";
import { setLocation } from "../../../support/next/navigation";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en;
const ADMIN = me();

describe("ApplicationLayout", () => {
	it("names the application in the header, the breadcrumbs and the tabs", async () => {
		await renderApplication(
			<ApplicationSessions />,
			SPA,
			{ "GET /api/applications/:id/sessions": { body: { sessions: [] } } },
			"/sessions",
		);

		await expect.element(page.getByText(t.applicationDetail.restricted)).toBeVisible();
		await expect.element(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
		await expect.element(page.getByText(t.quickstart.facts.disabled)).toBeVisible();
		await expect.element(page.getByText(t.quickstart.facts.public)).toBeVisible();
		await expect.element(page.getByRole("link", { name: `${t.applicationDetail.tabs.access}2` })).toBeVisible();
	});

	it("changes and removes the logo", async () => {
		await renderApplication(<ApplicationSessions />, WIKI, {
			"GET /api/applications/:id/sessions": { body: { sessions: [] } },
			"PUT /api/applications/:id/logo": { body: { client: { ...WIKI, logoUrl: "/api/media/logos/1/new.webp" } } },
			"DELETE /api/applications/:id/logo": { body: { client: WIKI } },
		});

		await page.getByRole("button", { name: t.applicationLogo.change }).click();
		await choose(await imageFile());
		await page.getByRole("button", { name: t.avatar.save }).click();
		await expect.element(page.getByText(t.applicationLogo.uploaded)).toBeVisible();

		await page.getByRole("button", { name: t.applicationLogo.change }).click();
		await page.getByRole("menuitem", { name: t.applicationLogo.remove }).click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.applicationLogo.removeConfirm }).click();
		await expect.element(page.getByText(t.applicationLogo.removed)).toBeVisible();
	});

	it("tells when an application does not exist and offers a retry for other errors", async () => {
		const server = mockApi({ "GET /api/applications/:id": apiError(400, "validation_failed") });
		setLocation("/applications/nope");
		await renderUi(<ApplicationLayout>tab</ApplicationLayout>, { me: ADMIN });
		await expect.element(page.getByText(t.applicationDetail.notFoundTitle)).toBeVisible();

		server.on({ "GET /api/applications/:id": apiError(500, "internal_error") });
		setLocation(`/applications/${WIKI.id}`);
		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/applications/:id": { body: { client: WIKI } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText("tab")).toBeVisible();
	});

	it("needs to wrap the tabs", async () => {
		function Tab() {
			useApplication();
			return null;
		}
		vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(renderUi(<Tab />, { me: ADMIN })).rejects.toThrow("useApplication must be used inside <ApplicationLayout>");
	});
});
