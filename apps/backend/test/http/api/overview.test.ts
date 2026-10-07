import { describe, expect, vi } from "vitest";
import { ADMIN, test } from "../../support/aegis.js";
import { testImage } from "../../support/images.js";
import { createApplication, signInThrough } from "../../support/oidc.js";

describe("GET /api/overview", () => {
	test("sums up accounts, applications and sign-in activity", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		await admin.request("PUT", `/api/applications/${application.id}/logo`, {
			headers: { "content-type": "image/png" },
			payload: await testImage(),
		});
		await createApplication(admin, { name: "Unused" });
		await aegis.createUser();
		await aegis.client().post("/api/auth/session", { email: ADMIN.email, password: "wrong password" });
		await signInThrough(aegis, application, ADMIN);

		const overview = await vi.waitFor(async () => {
			const body = (await admin.get("/api/overview")).json();
			expect(body.topApplications).toHaveLength(1);
			return body;
		});

		expect(overview).toMatchObject({
			instanceName: "Aegis Test",
			generatedAt: expect.any(String),
			// The failed attempt and the sign-in to the application; the setup signs in without a sign-in event.
			stats: { applications: 2, users: 1, admins: 1, activeSessions: 2, signIns24h: 1, failedSignIns24h: 1 },
			topApplications: [
				{ id: application.id, name: "Wiki", logoUrl: expect.stringMatching(/^\/api\/media\/logos\//), authorizations: 1 },
			],
		});
		expect(overview.activity).toHaveLength(14);
		expect(overview.activity.at(-1)).toEqual({ date: new Date().toISOString().slice(0, 10), succeeded: 1, failed: 1 });
		expect(overview.activity.slice(0, -1).every((day: { succeeded: number; failed: number }) => day.succeeded + day.failed === 0)).toBe(
			true,
		);
		expect(overview.recentEvents).toHaveLength(6);
	});

	test("ignores activity outside the fourteen days it shows", async ({ aegis }) => {
		const admin = await aegis.setup();
		vi.spyOn(aegis.services.audit, "dailySignIns").mockResolvedValueOnce([{ day: "2000-01-01", outcome: "success", value: 5 }]);

		const { activity } = (await admin.get("/api/overview")).json();

		expect(activity.every((day: { succeeded: number }) => day.succeeded === 0)).toBe(true);
	});

	test("is reserved for accounts that use the administration", async ({ aegis }) => {
		await aegis.setup();
		const user = await aegis.sessionFor(await aegis.createUser());

		expect((await aegis.client().get("/api/overview")).statusCode).toBe(401);
		expect((await user.get("/api/overview")).statusCode).toBe(403);
	});
});
