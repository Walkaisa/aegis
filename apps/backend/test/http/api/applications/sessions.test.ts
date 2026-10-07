import { describe, expect, vi } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { accessTokenOf, createApplication, isAccessTokenValid } from "../../../support/oidc.js";

describe("/api/applications/:id/sessions", () => {
	test("lists the sessions signed in to the application and ends them", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		const user = await aegis.createUser();
		const adminToken = await accessTokenOf(aegis, application, ADMIN.email, ADMIN.password);
		const userToken = await accessTokenOf(aegis, application, user.email, USER_PASSWORD);

		const sessions = await vi.waitFor(async () => {
			const list = (await admin.get(`/api/applications/${application.id}/sessions`)).json().sessions;
			expect(list).toHaveLength(2);
			return list as { sessionId: string; account: { id: string } }[];
		});
		const ofUser = sessions.find((session) => session.account.id === user.id);

		expect((await admin.delete(`/api/applications/${application.id}/sessions/${ofUser?.sessionId}`)).statusCode).toBe(204);
		expect(await isAccessTokenValid(aegis, userToken)).toBe(false);
		expect(await isAccessTokenValid(aegis, adminToken)).toBe(true);
		expect((await admin.delete(`/api/applications/${application.id}/sessions/${ofUser?.sessionId}`)).statusCode).toBe(404);
		expect((await admin.delete(`/api/applications/${application.id}/sessions/abc`)).statusCode).toBe(400);
		const [revoked] = await auditEvents(aegis, "client.session_revoked");
		expect(revoked?.subject).toMatchObject({ id: user.id });

		expect((await admin.delete(`/api/applications/${application.id}/sessions`)).statusCode).toBe(204);
		expect(await isAccessTokenValid(aegis, adminToken)).toBe(false);
		expect((await admin.get(`/api/applications/${application.id}/sessions`)).json().sessions).toEqual([]);
		expect(await auditEvents(aegis, "client.sessions_revoked")).toHaveLength(1);
	});
});
