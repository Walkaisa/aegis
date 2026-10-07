import { describe, expect, it, onTestFinished } from "vitest";
import { page, userEvent } from "vitest/browser";
import { OverviewPage } from "@/components/overview/overview-page";
import { apiError, mockApi } from "../../../support/api";
import { me, overview } from "../../../support/fixtures";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en;

describe("OverviewPage", () => {
	it("greets the admin and shows the figures, the chart and the latest events", async () => {
		// The size the stylesheet gives the chart; the tests load no styles.
		const size = document.createElement("style");
		size.textContent = "[data-slot='chart'] { display: block; width: 640px; height: 240px; }";
		document.head.append(size);
		onTestFinished(() => size.remove());
		mockApi({ "GET /api/overview": { body: overview() } });
		await renderUi(<OverviewPage />, { me: me({ twoFactorEnabled: true }) });

		await expect.element(page.getByRole("heading", { name: translate("overview.greeting", { name: "Ada Lovelace" }) })).toBeVisible();
		await expect.element(page.getByText("12", { exact: true }).first()).toBeVisible();
		await expect.element(page.getByText(t.overview.gettingStarted.title)).not.toBeInTheDocument();
		await expect.element(page.getByRole("link", { name: /Wiki/ })).toHaveAttribute("href", "/applications/3220506287531888700");
		await expect.element(page.getByText(t.overview.activity.failureRate)).toBeVisible();
		await expect.poll(() => document.querySelectorAll(".recharts-bar-rectangle").length).toBeGreaterThan(0);
		const bar = document.querySelectorAll<SVGElement>(".recharts-bar-rectangle")[5];
		await userEvent.hover(page.elementLocator(bar ?? document.body));
		await expect.poll(() => document.querySelector(".recharts-tooltip-wrapper")?.textContent).toMatch(/Jan/);
		await expect.element(page.getByText(/signed in$/)).toBeVisible();
	});

	it("guides through the first steps", async () => {
		const empty = overview({ stats: { ...overview().stats, applications: 0 }, topApplications: [], recentEvents: [], activity: [] });
		const server = mockApi({ "GET /api/overview": { body: empty } });
		await renderUi(<OverviewPage />, { me: me() });

		await expect.element(page.getByText(t.overview.gettingStarted.title)).toBeVisible();
		await expect.element(page.getByText(translate("overview.gettingStarted.progress", { done: 0, total: 3 }))).toBeVisible();
		await expect.element(page.getByText(t.overview.gettingStarted.steps.signIn.pending)).toBeVisible();
		await expect.element(page.getByText(t.overview.topApplications.empty)).toBeVisible();
		await expect.element(page.getByText(t.overview.noActivity)).toBeVisible();
		await expect.element(page.getByText("0%")).toBeVisible();
		expect(server.calls("GET /api/overview").length).toBeGreaterThan(0);
	});

	it("marks the steps that are done", async () => {
		const unused = overview({ topApplications: [{ id: "1", name: "Wiki", logoUrl: null, authorizations: 0 }] });
		mockApi({ "GET /api/overview": { body: unused } });
		await renderUi(<OverviewPage />, { me: me({ twoFactorEnabled: true }) });

		await expect.element(page.getByText(translate("overview.gettingStarted.progress", { done: 2, total: 3 }))).toBeVisible();
		await expect.element(page.getByRole("link", { name: t.overview.gettingStarted.steps.signIn.action })).toBeVisible();
		expect(page.getByText(t.overview.gettingStarted.done, { exact: true }).elements()).toHaveLength(2);
	});

	it("offers a retry when the figures cannot be loaded", async () => {
		const server = mockApi({ "GET /api/overview": apiError(500, "internal_error") });
		await renderUi(<OverviewPage />, { me: me() });

		await expect.element(page.getByText(t.common.loadFailed)).toBeVisible();
		expect(document.querySelectorAll("[aria-busy='true']").length).toBeGreaterThan(0);
		server.on({ "GET /api/overview": { body: overview() } });
		await page.getByRole("button", { name: t.common.retry }).click();
		await expect.element(page.getByText(t.common.loadFailed)).not.toBeInTheDocument();
	});
});
