import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { ApplicationAccess } from "@/components/applications/application-access";
import { apiError } from "../../../support/api";
import { renderApplication, SPA, WIKI } from "../../../support/applications";
import { clientUser, NOW, user } from "../../../support/fixtures";
import { MESSAGES, translate } from "../../../support/render";

const t = MESSAGES.en;

describe("ApplicationAccess", () => {
	const assigned = [
		clientUser(),
		clientUser({ id: "3220506287531888651", displayName: "Alan Turing", email: "alan@example.com", role: "admin" }),
	];

	it("restricts access and manages the assigned accounts", async () => {
		const { server } = await renderApplication(<ApplicationAccess />, WIKI, {
			"GET /api/applications/:id/users": { body: { users: assigned } },
			"PUT /api/applications/:id": ({ body }) => ({ body: { client: { ...WIKI, ...(body as object), updatedAt: NOW } } }),
			"GET /api/users": {
				body: {
					users: [
						user({ id: "3220506287531888650" }),
						user({ id: "77", displayName: "Barbara Liskov", email: "barbara@example.com" }),
					],
				},
			},
			"PUT /api/applications/:id/users/:userId": { status: 204 },
			"DELETE /api/applications/:id/users/:userId": { status: 204 },
		});

		await expect.element(page.getByText(t.applicationAccess.inactiveNotice)).toBeVisible();
		for (const column of ["role", "assignedAt", "account"] as const) {
			await page.getByRole("button", { name: t.applicationAccess.columns[column], exact: true }).click();
		}
		await page.getByRole("radio", { name: new RegExp(t.applicationAccess.policies.assigned.title) }).click();
		await expect.element(page.getByText(t.applicationAccess.restrictTitle)).toBeVisible();
		await page.getByRole("button", { name: t.applicationAccess.save }).click();
		await expect.element(page.getByText(t.applicationAccess.saved)).toBeVisible();
		expect(server.calls("PUT /api/applications/:id")[0]?.body).toMatchObject({ accessPolicy: "assigned", name: "Wiki" });

		await page.getByRole("button", { name: t.applicationAccess.assign }).click();
		await page.getByRole("combobox", { name: t.applicationAccess.assignLabel }).click();
		await expect.element(page.getByRole("option", { name: /Grace/ })).not.toBeInTheDocument();
		await page.getByRole("option", { name: /Barbara Liskov/ }).click();
		await page.getByRole("button", { name: t.applicationAccess.assignConfirm }).click();
		await expect.element(page.getByText(translate("applicationAccess.assignedToast", { account: "Barbara Liskov" }))).toBeVisible();
		expect(server.calls("PUT /api/applications/:id/users/:userId")[0]?.params.userId).toBe("77");

		await page.getByRole("button", { name: t.applicationAccess.remove, exact: true }).first().click();
		await page.getByRole("alertdialog").getByRole("button", { name: t.applicationAccess.removeConfirm }).click();
		await expect.element(page.getByText(/Assignment of .* removed\./)).toBeVisible();
	});

	it("reports failures and lets the assignment be cancelled", async () => {
		const { server } = await renderApplication(<ApplicationAccess />, SPA, {
			"GET /api/applications/:id/users": apiError(500, "internal_error"),
			"PUT /api/applications/:id": apiError(500, "internal_error"),
			"GET /api/users": { body: { users: [user({ id: "77", displayName: "Barbara Liskov" })] } },
			"PUT /api/applications/:id/users/:userId": apiError(404, "not_found"),
		});

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/applications/:id/users": { body: { users: [] } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.applicationAccess.emptyTitle)).toBeVisible();

		await page.getByRole("radio", { name: new RegExp(t.applicationAccess.policies.everyone.title) }).click();
		await page.getByRole("button", { name: t.applicationAccess.save }).click();
		await expect.element(page.getByText(t.errors.internal_error)).toBeVisible();

		await page.getByRole("button", { name: t.applicationAccess.assign }).click();
		await page.getByRole("combobox", { name: t.applicationAccess.assignLabel }).click();
		await page.getByRole("option", { name: /Barbara Liskov/ }).click();
		await page.getByRole("button", { name: t.applicationAccess.assignConfirm }).click();
		await expect.element(page.getByText(t.errors.not_found)).toBeVisible();
		await page.getByRole("dialog").getByRole("button", { name: t.common.cancel }).click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

		server.on({ "PUT /api/applications/:id/users/:userId": "pending" });
		await page.getByRole("button", { name: t.applicationAccess.assign }).click();
		await page.getByRole("combobox", { name: t.applicationAccess.assignLabel }).click();
		await page.getByRole("option", { name: /Barbara Liskov/ }).click();
		await page.getByRole("button", { name: t.applicationAccess.assignConfirm }).click();
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("dialog")).toBeVisible();
	});
});
