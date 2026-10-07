import { describe, expect, vi } from "vitest";
import { test } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";

describe("/api/settings", () => {
	test("shows the instance settings", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.get("/api/settings")).json()).toEqual({
			instanceName: "Aegis Test",
			sessionTtlDays: 30,
			auditRetentionDays: aegis.config.auditRetentionDays,
			issuer: aegis.config.issuer,
			setupCompletedAt: expect.any(String),
		});
	});

	test("changes any subset of the settings", async ({ aegis }) => {
		const admin = await aegis.setup();
		const reload = vi.spyOn(aegis.services.oidc, "reload");

		const renamed = await admin.patch("/api/settings", { instanceName: "Example SSO" });
		expect(renamed.json()).toMatchObject({ instanceName: "Example SSO", sessionTtlDays: 30 });
		expect(reload).not.toHaveBeenCalled();

		const longer = await admin.patch("/api/settings", { sessionTtlDays: 60, auditRetentionDays: 90 });
		expect(longer.json()).toMatchObject({ instanceName: "Example SSO", sessionTtlDays: 60, auditRetentionDays: 90 });
		expect(reload).toHaveBeenCalledOnce();

		const [event] = await auditEvents(aegis, "settings.updated");
		expect(event?.metadata).toEqual({ instanceName: "Example SSO", sessionTtlDays: 60, auditRetentionDays: 90 });
		expect((await aegis.client().get("/api/instance")).json().instanceName).toBe("Example SSO");
	});

	test("rejects values out of range and is reserved for admins", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.sessionFor(await aegis.createUser());

		expect((await admin.patch("/api/settings", { sessionTtlDays: 0 })).json().error.issues).toEqual([
			{ path: "sessionTtlDays", code: "out_of_range" },
		]);
		expect((await user.get("/api/settings")).statusCode).toBe(403);
		expect((await user.patch("/api/settings", { instanceName: "Mine" })).statusCode).toBe(403);
	});
});
