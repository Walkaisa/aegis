import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { UserApplications } from "@/components/users/user-applications";
import { apiError } from "../../../support/api";
import { user, userApplication } from "../../../support/fixtures";
import { MESSAGES, translate } from "../../../support/render";
import { GRACE, renderAccount } from "../../../support/users";

const t = MESSAGES.en;

describe("UserApplications", () => {
	const applications = [
		userApplication({ id: "1", name: "Wiki" }),
		userApplication({ id: "2", name: "Payroll", accessPolicy: "assigned", canSignIn: false }),
		userApplication({ id: "3", name: "Grafana", assigned: true }),
	];

	it("assigns and unassigns applications", async () => {
		const { server } = await renderAccount(<UserApplications />, GRACE, {
			"GET /api/users/:id/applications": { body: { applications } },
			"PUT /api/applications/:id/users/:userId": { status: 204 },
			"DELETE /api/applications/:id/users/:userId": { status: 204 },
		});

		await expect.element(page.getByText(t.userApplications.notNeeded).first()).toBeVisible();
		await expect.element(page.getByText(t.userApplications.denied).first()).toBeVisible();
		for (const column of ["policy", "signIn", "assigned", "application"] as const) {
			await page.getByRole("button", { name: t.userApplications.columns[column], exact: true }).click();
		}
		await page
			.getByRole("switch", { name: translate("userApplications.assign", { name: "Payroll" }) })
			.first()
			.click();
		await expect.element(page.getByText(translate("userApplications.assignedToast", { name: "Payroll" }))).toBeVisible();
		await page
			.getByRole("switch", { name: translate("userApplications.assign", { name: "Grafana" }) })
			.first()
			.click();
		await expect.element(page.getByText(translate("userApplications.unassignedToast", { name: "Grafana" }))).toBeVisible();
		expect(server.calls("PUT /api/applications/:id/users/:userId")[0]?.params).toEqual({ id: "2", userId: GRACE.id });

		server.on({ "PUT /api/applications/:id/users/:userId": apiError(500, "internal_error") });
		await page
			.getByRole("switch", { name: translate("userApplications.assign", { name: "Payroll" }) })
			.first()
			.click();
		await expect.element(page.getByText(t.errors.internal_error)).toBeVisible();
	});

	it("explains that admins may sign in everywhere and offers a retry", async () => {
		const { server } = await renderAccount(<UserApplications />, user(), {
			"GET /api/users/:id/applications": apiError(500, "internal_error"),
		});

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		server.on({ "GET /api/users/:id/applications": { body: { applications: [] } } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.userApplications.adminNotice)).toBeVisible();
		await expect.element(page.getByText(t.userApplications.emptyTitle)).toBeVisible();
	});
});
