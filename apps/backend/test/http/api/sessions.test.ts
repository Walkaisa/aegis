import { describe, expect, vi } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../support/aegis.js";
import { auditEvents } from "../../support/audit.js";
import { createApplication, exchangeCode, signInThrough, userinfo } from "../../support/oidc.js";

describe("GET /api/sessions", () => {
	test("lists the sessions of all accounts with their applications", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		const user = await aegis.createUser({ displayName: "Grace" });
		await signInThrough(aegis, application, { email: user.email, password: USER_PASSWORD });

		const sessions = await vi.waitFor(async () => {
			const list = (await admin.get("/api/sessions")).json().sessions as { account: { id: string }; applications: unknown[] }[];
			expect(list.find((session) => session.account.id === user.id)?.applications).toHaveLength(1);
			return list;
		});

		expect(sessions).toHaveLength(2);
		const own = sessions.find((session) => session.account.id !== user.id);
		expect(own).toMatchObject({ current: true, applications: [], secondFactor: false, userAgent: "Aegis tests" });
		expect(sessions.find((session) => session.account.id === user.id)).toMatchObject({
			current: false,
			account: { displayName: "Grace", role: "user", avatarUrl: null },
			applications: [{ id: application.id, name: "Wiki", logoUrl: null, lastAuthorizedAt: expect.any(String) }],
		});
	});

	test("is reserved for admins", async ({ aegis }) => {
		await aegis.setup();
		const user = await aegis.sessionFor(await aegis.createUser());

		expect((await user.get("/api/sessions")).statusCode).toBe(403);
		expect((await user.delete("/api/sessions")).statusCode).toBe(403);
	});
});

describe("DELETE /api/sessions", () => {
	test("ends every session and every token, the own one included", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const user = await aegis.sessionFor(await aegis.createUser());
		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);

		const response = await admin.delete("/api/sessions");

		expect(response.json()).toEqual({ revoked: 3 });
		expect(admin.cookie(aegis.services.sessionCookie.name)).toBeUndefined();
		expect((await user.get("/api/auth/session")).statusCode).toBe(401);
		expect((await userinfo(aegis, tokens.access_token)).statusCode).toBe(401);
		const [event] = await auditEvents(aegis, "session.all_revoked");
		expect(event?.metadata).toEqual({ sessions: 3 });
	});
});

describe("DELETE /api/sessions/:id", () => {
	test("ends the session of another account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();
		const browser = await aegis.sessionFor(user);
		const [session] = await aegis.services.sessions.listActive(new Date(), user.id);

		expect((await admin.delete(`/api/sessions/${session?.session.id}`)).statusCode).toBe(204);

		expect((await browser.get("/api/auth/session")).statusCode).toBe(401);
		expect((await admin.get("/api/auth/session")).statusCode).toBe(200);
		const [event] = await auditEvents(aegis, "session.revoked");
		expect(event).toMatchObject({ subject: { id: user.id }, metadata: { sessions: 1, role: "user", current: false } });
		expect((await admin.delete(`/api/sessions/${session?.session.id}`)).statusCode).toBe(404);
	});

	test("signs this browser out when it ends its own session", async ({ aegis }) => {
		const admin = await aegis.setup();
		const own = (await admin.get("/api/auth/session")).json().session.id as string;

		expect((await admin.delete(`/api/sessions/${own}`)).statusCode).toBe(204);

		expect(admin.cookie(aegis.services.sessionCookie.name)).toBeUndefined();
		const [event] = await auditEvents(aegis, "session.revoked");
		expect(event?.metadata.current).toBe(true);
	});

	test("rejects sessions that are unknown or ended meanwhile", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();
		await aegis.sessionFor(user);
		const [session] = await aegis.services.sessions.listActive(new Date(), user.id);
		const id = session?.session.id as string;

		expect((await admin.delete("/api/sessions/1")).statusCode).toBe(404);
		expect((await admin.delete("/api/sessions/abc")).statusCode).toBe(400);

		vi.spyOn(aegis.services.users, "findById").mockResolvedValueOnce(null);
		expect((await admin.delete(`/api/sessions/${id}`)).statusCode).toBe(404);
		vi.spyOn(aegis.services.auth, "endSession").mockResolvedValueOnce(false);
		expect((await admin.delete(`/api/sessions/${id}`)).statusCode).toBe(404);
		expect(await auditEvents(aegis, "session.revoked")).toEqual([]);
	});
});
