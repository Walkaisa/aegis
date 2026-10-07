import { describe, expect, vi } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { testImage } from "../../../support/images.js";
import { enableTwoFactor } from "../../../support/two-factor.js";

describe("/api/users/:id", () => {
	test("rejects ids that are not snowflakes and unknown accounts", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.get("/api/users/abc")).json().error).toMatchObject({
			code: "validation_failed",
			issues: [{ path: "id", code: "invalid" }],
		});
		expect((await admin.get("/api/users/1")).statusCode).toBe(404);
		expect(
			(await admin.put("/api/users/1", { displayName: "X", email: "x@aegis.test", role: "user", emailVerified: true })).statusCode,
		).toBe(404);
		expect((await admin.delete("/api/users/1")).statusCode).toBe(404);
		expect((await admin.post("/api/users/1/password", { mode: "generate" })).statusCode).toBe(404);
		expect((await admin.get("/api/users/1/applications")).statusCode).toBe(404);
		expect((await admin.get("/api/users/1/sessions")).statusCode).toBe(404);
		expect((await admin.delete("/api/users/1/sessions")).statusCode).toBe(404);
		expect((await admin.delete("/api/users/1/two-factor")).statusCode).toBe(404);
		expect((await admin.post("/api/users/1/enable")).statusCode).toBe(404);
	});

	test("changes profile and role; a new role ends the account's sessions", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();
		const browser = await aegis.sessionFor(user);

		const renamed = await admin.put(`/api/users/${user.id}`, {
			displayName: "Renamed",
			email: user.email,
			role: "user",
			emailVerified: false,
		});
		expect(renamed.json().user).toMatchObject({ displayName: "Renamed", emailVerified: false });
		expect((await browser.get("/api/auth/session")).statusCode).toBe(200);

		const promoted = await admin.put(`/api/users/${user.id}`, {
			displayName: "Renamed",
			email: "promoted@aegis.test",
			role: "admin",
			emailVerified: true,
		});
		expect(promoted.json().user).toMatchObject({ role: "admin", email: "promoted@aegis.test" });
		expect((await browser.get("/api/auth/session")).statusCode).toBe(401);
		const [changed] = await auditEvents(aegis, "user.role_changed");
		expect(changed?.metadata).toEqual({ from: "user", to: "admin" });
		expect((await auditEvents(aegis, "user.updated")).map((event) => event.metadata.emailChanged)).toEqual([true, false]);
	});

	test("never leaves Aegis without an enabled admin", async ({ aegis }) => {
		const admin = await aegis.setup();
		const me = (await admin.get("/api/auth/session")).json().account.id as string;
		const demote = { displayName: ADMIN.displayName, email: ADMIN.email, role: "user", emailVerified: true };

		for (const response of [
			await admin.put(`/api/users/${me}`, demote),
			await admin.post(`/api/users/${me}/disable`),
			await admin.delete(`/api/users/${me}`),
		]) {
			expect(response.statusCode).toBe(409);
			expect(response.json().error.code).toBe("last_active_admin");
		}
		expect((await admin.get(`/api/users/${me}`)).json().user.isLastActiveAdmin).toBe(true);

		const second = await aegis.createUser({ role: "admin" });
		expect((await admin.get(`/api/users/${me}`)).json().user.isLastActiveAdmin).toBe(false);
		expect((await admin.post(`/api/users/${second.id}/disable`)).statusCode).toBe(200);
		expect((await admin.delete(`/api/users/${second.id}`)).statusCode).toBe(204);
	});

	test("rejects an address another account uses", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();

		const response = await admin.put(`/api/users/${user.id}`, {
			displayName: "X",
			email: ADMIN.email,
			role: "user",
			emailVerified: true,
		});

		expect(response.statusCode).toBe(409);
		expect(response.json().error.code).toBe("email_taken");
	});

	test("disables and enables an account; disabling ends its sessions", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();
		const browser = await aegis.sessionFor(user);

		expect((await admin.post(`/api/users/${user.id}/disable`)).json().user.enabled).toBe(false);
		expect((await browser.get("/api/auth/session")).statusCode).toBe(401);
		expect((await admin.post(`/api/users/${user.id}/disable`)).json().user.enabled).toBe(false);
		expect((await admin.post(`/api/users/${user.id}/enable`)).json().user.enabled).toBe(true);

		expect((await auditEvents(aegis, "user.disabled")).length).toBe(1);
		expect((await auditEvents(aegis, "user.enabled")).length).toBe(1);
	});

	test("deletes an account and keeps its name in the audit log", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser({ email: "leaving@aegis.test" });

		expect((await admin.delete(`/api/users/${user.id}`)).statusCode).toBe(204);

		expect((await admin.get(`/api/users/${user.id}`)).statusCode).toBe(404);
		const [event] = await auditEvents(aegis, "user.deleted");
		expect(event?.subject).toMatchObject({ id: null, label: "leaving@aegis.test", name: null });
	});

	test("sets a generated or chosen password and ends the account's sessions", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser({ role: "admin" });
		const browser = await aegis.signIn(user.email, USER_PASSWORD);

		const generated = await admin.post(`/api/users/${user.id}/password`, { mode: "generate" });
		const password = generated.json().generatedPassword as string;
		expect(password).toMatch(/^[\w-]{24}$/);
		expect((await browser.get("/api/auth/session")).statusCode).toBe(401);
		expect((await aegis.client().post("/api/auth/session", { email: user.email, password })).statusCode).toBe(201);

		const manual = await admin.post(`/api/users/${user.id}/password`, { mode: "manual", password: "chosen by the admin" });
		expect(manual.json().generatedPassword).toBeNull();
		expect((await aegis.client().post("/api/auth/session", { email: user.email, password: "chosen by the admin" })).statusCode).toBe(
			201,
		);
		expect((await auditEvents(aegis, "user.password_reset")).map((event) => event.metadata.generated)).toEqual([false, true]);
	});

	test("turns two-factor authentication off for other accounts only", async ({ aegis }) => {
		const admin = await aegis.setup();
		const me = (await admin.get("/api/auth/session")).json().account.id as string;
		const other = await aegis.createUser({ role: "admin" });
		await enableTwoFactor(await aegis.signIn(other.email, USER_PASSWORD), USER_PASSWORD);

		expect((await admin.delete(`/api/users/${me}/two-factor`)).statusCode).toBe(403);
		const reset = await admin.delete(`/api/users/${other.id}/two-factor`);
		expect(reset.json().user.twoFactorEnabled).toBe(false);
		expect((await admin.delete(`/api/users/${other.id}/two-factor`)).statusCode).toBe(200);
		expect(await auditEvents(aegis, "user.two_factor_reset")).toHaveLength(1);
	});

	test("clears an unconfirmed two-factor setup of another account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const other = await aegis.createUser({ role: "admin" });
		await (await aegis.signIn(other.email, USER_PASSWORD)).post("/api/account/two-factor/setup", { currentPassword: USER_PASSWORD });

		await admin.delete(`/api/users/${other.id}/two-factor`);

		expect((await aegis.services.users.findById(other.id))?.totpSecret).toBeNull();
		expect(await auditEvents(aegis, "user.two_factor_reset")).toHaveLength(1);
	});

	test("lists the account's sessions and ends them", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();
		await aegis.sessionFor(user);
		await aegis.sessionFor(user);

		const sessions = await admin.get(`/api/users/${user.id}/sessions`);
		expect(sessions.json().sessions).toHaveLength(2);
		expect(sessions.json().sessions[0]).toMatchObject({
			current: false,
			account: { id: user.id },
			secondFactor: false,
			applications: [],
		});

		expect((await admin.delete(`/api/users/${user.id}/sessions`)).json()).toEqual({ revoked: 2 });
		expect((await admin.get(`/api/users/${user.id}/sessions`)).json().sessions).toEqual([]);
		const [event] = await auditEvents(aegis, "session.revoked");
		expect(event?.metadata).toEqual({ sessions: 2 });
	});

	test("lists the applications the account may sign in to", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();
		const client = {
			name: "Wiki",
			description: "",
			type: "confidential",
			tokenEndpointAuthMethod: "client_secret_basic",
			redirectUris: ["https://wiki.aegis.test/cb"],
			postLogoutRedirectUris: [],
			allowedScopes: ["openid"],
			skipConsent: false,
		};
		const open = (await admin.post("/api/applications", client)).json().client.id as string;
		const restricted = (await admin.post("/api/applications", { ...client, name: "HR", accessPolicy: "assigned" })).json().client
			.id as string;

		const applications = (await admin.get(`/api/users/${user.id}/applications`)).json().applications;

		expect(applications).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ id: open, assigned: false, canSignIn: true, accessPolicy: "everyone" }),
				expect.objectContaining({ id: restricted, assigned: false, canSignIn: false, accessPolicy: "assigned" }),
			]),
		);
		await admin.put(`/api/applications/${restricted}/users/${user.id}`);
		const assigned = (await admin.get(`/api/users/${user.id}/applications`)).json().applications;
		expect(assigned.find((application: { id: string }) => application.id === restricted)).toMatchObject({
			assigned: true,
			canSignIn: true,
		});
	});

	test("changes the profile picture of another account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();

		const response = await admin.request("PUT", `/api/users/${user.id}/avatar`, {
			headers: { "content-type": "image/png" },
			payload: await testImage(),
		});

		expect(response.json().user.avatarUrl).toMatch(/\.webp$/);
		expect((await admin.delete(`/api/users/${user.id}/avatar`)).json().user.avatarUrl).toBeNull();
		expect(
			(await admin.request("PUT", "/api/users/1/avatar", { headers: { "content-type": "image/png" }, payload: await testImage() }))
				.statusCode,
		).toBe(404);
		expect((await admin.delete("/api/users/1/avatar")).statusCode).toBe(404);
	});

	test("fails when the account cannot be stored or is gone meanwhile", async ({ aegis }) => {
		const admin = await aegis.setup();
		const user = await aegis.createUser();
		const update = { displayName: "Renamed", email: user.email, role: "user", emailVerified: true };
		vi.spyOn(aegis.services.users, "update").mockRejectedValueOnce(new Error("disk full")).mockResolvedValueOnce(null);

		expect((await admin.put(`/api/users/${user.id}`, update)).statusCode).toBe(500);
		expect((await admin.put(`/api/users/${user.id}`, update)).statusCode).toBe(404);
	});

	test("ends with 404 when the account is gone while its picture is removed", async ({ aegis }) => {
		const admin = await aegis.setup();
		const me = (await admin.get("/api/auth/session")).json().account.id as string;
		await admin.request("PUT", "/api/account/avatar", { headers: { "content-type": "image/png" }, payload: await testImage() });
		vi.spyOn(aegis.services.users, "update").mockResolvedValueOnce(null);

		expect((await admin.delete(`/api/users/${me}/avatar`)).statusCode).toBe(404);
	});
});
