import type { AuditEventDto, AuditSummaryResponse } from "@aegis/contracts";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { AuditPage } from "@/components/audit/audit-page";
import { apiError, mockApi } from "../../../support/api";
import { auditEvent } from "../../../support/fixtures";
import { router } from "../../../support/next/navigation";
import { MESSAGES, renderUi, translate } from "../../../support/render";

const t = MESSAGES.en.audit;

const SUMMARY: AuditSummaryResponse = {
	total: 3,
	bySeverity: { info: 2, notice: 0, warning: 1, error: 0, critical: 0 },
	oldestAt: "2026-01-01T09:30:00.000Z",
	newestAt: "2026-01-15T12:00:00.000Z",
	retentionDays: 90,
};

const ADA = { id: "1", label: "ada@example.com", name: "Ada Lovelace", role: "admin" as const, imageUrl: null };
const GRACE = { id: "2", label: "grace@example.com", name: "Grace Hopper", role: null, imageUrl: null };
const WIKI = { id: "7", label: "Wiki", name: "Wiki", role: null, imageUrl: "/api/media/logos/7/a.webp" };

const EVENTS: AuditEventDto[] = [
	auditEvent("oidc.authorization.succeeded", { actor: null, source: "application", subject: GRACE, client: WIKI }),
	auditEvent("auth.sign_in.failed", {
		actor: null,
		source: "user",
		ipAddress: null,
		userAgent: null,
		metadata: { email: "nobody@example.com", reason: "unknown_email", context: "admin" },
	}),
	auditEvent("email.sent", {
		actor: null,
		source: "system",
		metadata: {
			template: "password_reset",
			recipient: "grace@example.com",
			delivered: true,
			durationMs: 120,
			scopes: ["openid", "email"],
			messageId: null,
			customField: "x",
		},
	}),
	auditEvent("user.updated", { actor: ADA, subject: { ...GRACE, id: null, name: null }, metadata: { emailChanged: false } }),
	auditEvent("client.deleted", {
		actor: { ...ADA, role: null },
		source: "admin",
		client: { id: null, label: "Old app", name: null, role: null, imageUrl: null },
	}),
	auditEvent("auth.sign_in.succeeded", { actor: null, source: "user", subject: GRACE, metadata: { template: "unknown_template" } }),
	auditEvent("email.failed", { actor: null, source: "system", metadata: {} }),
	auditEvent("settings.updated", { actor: null, source: "system", subject: null }),
	auditEvent("session.revoked", { actor: null, source: "admin", subject: null }),
	auditEvent("oidc.token.failed", { actor: null, source: "application", client: null }),
	auditEvent("client.updated", {
		actor: ADA,
		source: "admin",
		client: { id: null, label: null, name: null, role: null, imageUrl: null },
	}),
];

function routes(events: AuditEventDto[] = EVENTS, summary: AuditSummaryResponse = SUMMARY) {
	return {
		"GET /api/audit/events": { body: { events, total: events.length, page: 1, perPage: 25 } },
		"GET /api/audit/summary": { body: summary },
	};
}

describe("AuditPage", () => {
	it("shows the events with who triggered them and from where", async () => {
		mockApi(routes());
		await renderUi(<AuditPage />);

		await expect.element(page.getByText("Grace Hopper signed in to “Wiki”").first()).toBeVisible();
		await expect.element(page.getByText(/^Oldest entry: Jan 1, 2026/)).toBeVisible();
		await expect.element(page.getByText("nobody@example.com").first()).toBeVisible();
		await expect.element(page.getByText(/unknown account/).first()).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.roles.admin).first()).toBeVisible();
		await expect.element(page.getByText(MESSAGES.en.devices.unknown).first()).toBeVisible();
		await expect.element(page.getByText(/unknown application/).first()).toBeVisible();
		await expect.element(page.getByText(/unknown recipient/).first()).toBeVisible();
	});

	it("filters by severity, range, search and the table filters", async () => {
		const server = mockApi(routes());
		await renderUi(<AuditPage />);
		await expect.element(page.getByText("Grace Hopper signed in to “Wiki”").first()).toBeVisible();
		const lastQuery = () => server.calls("GET /api/audit/events").at(-1)?.url.searchParams;

		await page.getByRole("button", { name: /Warning/ }).click();
		await expect.poll(() => lastQuery()?.get("severities")).toBe("warning");
		await page.getByRole("button", { name: /Info/ }).click();
		await expect.poll(() => lastQuery()?.get("severities")).toBe("warning,info");
		await page.getByRole("button", { name: /Warning/ }).click();
		await expect.poll(() => lastQuery()?.get("severities")).toBe("info");

		await page.getByRole("radio", { name: t.range.options["0"] }).click();
		await expect.poll(() => lastQuery()?.has("from")).toBe(false);
		await page.getByRole("radio", { name: t.range.options["0"] }).click();
		await expect.element(page.getByRole("radio", { name: t.range.options["0"] })).toHaveAttribute("aria-checked", "true");

		await page.getByRole("searchbox").fill("  grace  ");
		await expect.poll(() => lastQuery()?.get("search"), { timeout: 2000 }).toBe("grace");

		// The button counts the filters that are already set (the severity above).
		await page.getByRole("button", { name: /^Filters/ }).click();
		await page.getByRole("menuitemcheckbox", { name: t.categories.users }).click();
		await page.getByRole("menuitemcheckbox", { name: t.outcomes.failure }).click();
		await page.getByRole("menuitemcheckbox", { name: t.sources.admin }).click();
		await userEvent.keyboard("{Escape}");
		await expect.poll(() => lastQuery()?.get("sources")).toBe("admin");
		expect(lastQuery()?.get("categories")).toBe("users");
		expect(lastQuery()?.get("outcomes")).toBe("failure");

		await page.getByRole("button", { name: t.columns.occurredAt }).click();
		await expect.poll(() => lastQuery()?.get("order")).toBe("oldest");

		const calls = server.calls("GET /api/audit/events").length;
		await page.getByRole("button", { name: t.refresh }).click();
		await expect.poll(() => server.calls("GET /api/audit/events").length).toBe(calls + 1);
	});

	it("opens an event with everything recorded about it", async () => {
		vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
		mockApi(routes());
		await renderUi(<AuditPage />);

		await page.getByText("Email to grace@example.com sent").first().click();
		const panel = page.getByRole("dialog");
		await expect.element(panel.getByText(t.templates.password_reset)).toBeVisible();
		await expect.element(panel.getByText("openid, email")).toBeVisible();
		await expect.element(panel.getByText("customField")).toBeVisible();
		await expect.element(panel.getByText(t.details.yes)).toBeVisible();
		await expect.element(panel.getByText("120")).toBeVisible();
		await panel.getByRole("button", { name: MESSAGES.en.common.copy }).click();
		await panel.getByRole("button", { name: MESSAGES.en.common.close }).click();
		await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();

		await page.getByText("Grace Hopper signed in to “Wiki”").first().click();
		await expect.element(page.getByRole("dialog").getByRole("link", { name: /Wiki/ })).toBeVisible();
		await page
			.getByRole("dialog")
			.getByRole("link", { name: /Grace Hopper/ })
			.click();
		expect(router.push).toHaveBeenLastCalledWith("/users/2");
		await userEvent.keyboard("{Escape}");

		await page.getByText("Sign-in failed").first().click();
		await expect.element(page.getByRole("dialog").getByText(t.reasons.unknown_email, { exact: false })).not.toBeInTheDocument();
		await expect.element(page.getByRole("dialog").getByText(t.details.unknown).first()).toBeVisible();
		await userEvent.keyboard("{Escape}");

		await page
			.getByText(/Application “Old app” deleted/)
			.first()
			.click();
		await expect.element(page.getByRole("dialog").getByText("Old app")).toBeVisible();
		await expect.element(page.getByRole("dialog").getByRole("link", { name: /Old app/ })).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");

		await page
			.getByText(/Account .* updated/)
			.first()
			.click();
		await expect.element(page.getByRole("dialog").getByText(t.details.no)).toBeVisible();
		await userEvent.keyboard("{Escape}");

		await page
			.getByText(/signed in$/)
			.first()
			.click();
		await expect.element(page.getByRole("dialog").getByText("unknown_template")).toBeVisible();
		await userEvent.keyboard("{Escape}");

		// An application that is gone without a trace.
		await page
			.getByText(/Application .*updated/)
			.first()
			.click();
		await expect.element(page.getByRole("dialog").getByText(t.details.unknown, { exact: true }).first()).toBeVisible();
	});

	it("changes how long entries are kept", async () => {
		const server = mockApi({
			...routes(),
			"PATCH /api/settings": ({ body }) => ({
				body: { auditRetentionDays: (body as { auditRetentionDays: number }).auditRetentionDays },
			}),
		});
		await renderUi(<AuditPage />);

		await page.getByRole("button", { name: translate("audit.retention.label", { days: 90 }) }).click();
		await page.getByRole("menuitem", { name: translate("audit.retention.option", { days: 90 }) }).click();
		expect(server.calls("PATCH /api/settings")).toEqual([]);

		await page.getByRole("button", { name: translate("audit.retention.label", { days: 90 }) }).click();
		await page.getByRole("menuitem", { name: translate("audit.retention.option", { days: 30 }) }).click();
		await expect.element(page.getByText(translate("audit.retention.saved", { days: 30 }))).toBeVisible();
		await expect.element(page.getByRole("button", { name: translate("audit.retention.label", { days: 30 }) })).toBeVisible();

		server.on({ "PATCH /api/settings": apiError(403, "forbidden") });
		await page.getByRole("button", { name: translate("audit.retention.label", { days: 30 }) }).click();
		await page.getByRole("menuitem", { name: translate("audit.retention.option", { days: 7 }) }).click();
		await expect.element(page.getByText(MESSAGES.en.errors.forbidden)).toBeVisible();
	});

	it("shows an empty log and load errors", async () => {
		const server = mockApi({ "GET /api/audit/events": apiError(500, "internal_error"), "GET /api/audit/summary": "pending" });
		await renderUi(<AuditPage />);

		await expect.element(page.getByText(MESSAGES.en.common.loadFailed)).toBeVisible();
		server.on(
			routes([], { ...SUMMARY, total: 0, bySeverity: { info: 0, notice: 0, warning: 0, error: 0, critical: 0 }, oldestAt: null }),
		);
		await page.getByRole("button", { name: MESSAGES.en.common.retry }).click();

		await expect.element(page.getByText(t.emptyTitle)).toBeVisible();
		await expect.element(page.getByText(/^Oldest entry/)).not.toBeInTheDocument();
	});
});
