import { describe, expect } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import type { TestClient } from "../../../support/client.js";
import { accessTokenOf, createApplication, isAccessTokenValid, type TestApplication } from "../../../support/oidc.js";

describe("/api/applications/:id/users", () => {
	async function assignedEmails(admin: TestClient, application: TestApplication): Promise<string[]> {
		const response = await admin.get(`/api/applications/${application.id}/users`);
		return response.json().users.map((user: { email: string }) => user.email);
	}

	test("assigns accounts once and removes them again", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const user = await aegis.createUser({ email: "grace@aegis.test" });

		expect((await admin.put(`/api/applications/${application.id}/users/${user.id}`)).statusCode).toBe(204);
		expect((await admin.put(`/api/applications/${application.id}/users/${user.id}`)).statusCode).toBe(204);
		expect(await assignedEmails(admin, application)).toEqual(["grace@aegis.test"]);
		expect((await admin.get(`/api/applications/${application.id}`)).json().client.assignedUserCount).toBe(1);

		expect((await admin.delete(`/api/applications/${application.id}/users/${user.id}`)).statusCode).toBe(204);
		expect((await admin.delete(`/api/applications/${application.id}/users/${user.id}`)).statusCode).toBe(204);
		expect(await assignedEmails(admin, application)).toEqual([]);
		expect(await auditEvents(aegis, "client.user_assigned")).toHaveLength(1);
		expect(await auditEvents(aegis, "client.user_unassigned")).toHaveLength(1);
	});

	test("rejects unknown accounts", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);

		expect((await admin.put(`/api/applications/${application.id}/users/1`)).statusCode).toBe(404);
		expect((await admin.delete(`/api/applications/${application.id}/users/1`)).statusCode).toBe(404);
		expect((await admin.put(`/api/applications/${application.id}/users/abc`)).statusCode).toBe(400);
		expect((await admin.put(`/api/applications/1/users/1`)).statusCode).toBe(404);
	});

	test("revokes the sign-ins of an account that loses access with its assignment", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true, accessPolicy: "assigned" });
		const user = await aegis.createUser();
		const adminId = (await admin.get("/api/auth/session")).json().account.id as string;
		await admin.put(`/api/applications/${application.id}/users/${user.id}`);
		await admin.put(`/api/applications/${application.id}/users/${adminId}`);
		const userToken = await accessTokenOf(aegis, application, user.email, USER_PASSWORD);
		const adminToken = await accessTokenOf(aegis, application, ADMIN.email, ADMIN.password);

		await admin.delete(`/api/applications/${application.id}/users/${user.id}`);
		await admin.delete(`/api/applications/${application.id}/users/${adminId}`);

		expect(await isAccessTokenValid(aegis, userToken)).toBe(false);
		expect(await isAccessTokenValid(aegis, adminToken)).toBe(true);
	});
});
