import { describe, expect, it } from "vitest";
import { page } from "vitest/browser";
import { EventList } from "@/components/dashboard/event-list";
import { auditEvent } from "../../../support/fixtures";
import { MESSAGES, renderUi } from "../../../support/render";

const t = MESSAGES.en;

describe("EventList", () => {
	it("groups events by day and adds why, by whom and from where", async () => {
		const now = new Date();
		const yesterday = new Date(now);
		yesterday.setDate(now.getDate() - 1);
		const lastWeek = new Date(now);
		lastWeek.setDate(now.getDate() - 6);
		await renderUi(
			<EventList
				events={[
					auditEvent("auth.sign_in.failed", {
						occurredAt: now.toISOString(),
						actor: null,
						metadata: { reason: "invalid_password" },
					}),
					auditEvent("user.disabled", {
						occurredAt: now.toISOString(),
						subject: { id: "2", label: "grace@example.com", name: "Grace", role: "user", imageUrl: null },
					}),
					auditEvent("email.failed", {
						occurredAt: yesterday.toISOString(),
						actor: null,
						userAgent: null,
						metadata: { reason: "something_new" },
					}),
					auditEvent("user.updated", {
						occurredAt: lastWeek.toISOString(),
						subject: { id: "3220506287531888640", label: "a", name: "Ada", role: "admin", imageUrl: null },
					}),
				]}
			/>,
		);

		await expect.element(page.getByRole("region", { name: "Today" })).toBeVisible();
		await expect.element(page.getByRole("region", { name: "Yesterday" })).toBeVisible();
		await expect.element(page.getByText(t.audit.reasons.invalid_password)).toBeVisible();
		await expect.element(page.getByText(/by Ada Lovelace/).first()).toBeVisible();
		await expect.element(page.getByText(t.audit.severities.error)).toBeVisible();
		expect(page.getByRole("region", { name: /Today|Yesterday|day/ }).elements()).toHaveLength(3);
	});
});
