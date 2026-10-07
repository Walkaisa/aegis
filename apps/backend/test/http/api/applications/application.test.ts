import { describe, expect, vi } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { testImage } from "../../../support/images.js";
import {
	accessTokenOf,
	applicationInput,
	authorize,
	challengeOf,
	createApplication,
	isAccessTokenValid,
	REDIRECT_URI,
	signInThrough,
	tokenRequest,
} from "../../../support/oidc.js";

/** The settings form of an application, as the web UI sends it back. */
function settingsOf(overrides: Record<string, unknown> = {}) {
	const { type: _type, ...input } = applicationInput();
	return { ...input, enabled: true, accessPolicy: "everyone", pkcePolicy: "optional", ...overrides };
}

describe("/api/applications/:id", () => {
	test("rejects ids that are not snowflakes and unknown applications", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.get("/api/applications/abc")).statusCode).toBe(400);
		for (const [method, path] of [
			["GET", ""],
			["PUT", ""],
			["DELETE", ""],
			["POST", "/secret"],
			["GET", "/users"],
			["GET", "/sessions"],
			["DELETE", "/sessions"],
			["DELETE", "/logo"],
		] as const) {
			const body = method === "PUT" ? settingsOf() : undefined;
			const response = await admin.request(method, `/api/applications/1${path}`, body ? { body } : {});
			expect(response.statusCode, `${method} ${path}`).toBe(404);
		}
	});

	test("changes the settings but never the client type", async ({ aegis }) => {
		const admin = await aegis.setup();
		const confidential = await createApplication(admin);
		const spa = await createApplication(admin, { name: "SPA", type: "public" });

		const renamed = await admin.put(
			`/api/applications/${confidential.id}`,
			settingsOf({ name: "Docs", type: "public", tokenEndpointAuthMethod: "client_secret_post" }),
		);
		expect(renamed.json().client).toMatchObject({ name: "Docs", type: "confidential", tokenEndpointAuthMethod: "client_secret_post" });

		const publicClient = await admin.put(`/api/applications/${spa.id}`, settingsOf({ name: "SPA", pkcePolicy: "required" }));
		expect(publicClient.json().client).toMatchObject({ type: "public", tokenEndpointAuthMethod: "none" });
		const weakened = await admin.put(`/api/applications/${spa.id}`, settingsOf({ name: "SPA", pkcePolicy: "disabled" }));
		expect(weakened.json().error.issues).toEqual([{ path: "pkcePolicy", code: "pkce_required_for_public_clients" }]);

		const [updated] = await auditEvents(aegis, "client.updated");
		expect(updated?.metadata).toEqual({
			enabled: true,
			scopes: ["openid", "profile", "email"],
			accessPolicy: "everyone",
			pkcePolicy: "required",
		});
	});

	test("revokes every sign-in when an application is disabled", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const token = await accessTokenOf(aegis, application, ADMIN.email, ADMIN.password);

		const disabled = await admin.put(`/api/applications/${application.id}`, settingsOf({ enabled: false }));

		expect(disabled.json().client.enabled).toBe(false);
		expect(await isAccessTokenValid(aegis, token)).toBe(false);
		expect((await authorize(aegis.client(), application)).location.pathname).toBe("/error");
		expect((await admin.put(`/api/applications/${application.id}`, settingsOf({ enabled: true }))).json().client.enabled).toBe(true);
	});

	test("revokes the sign-ins of accounts that lose access through a restriction", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		const [kept, dropped] = [await aegis.createUser(), await aegis.createUser()];
		await admin.put(`/api/applications/${application.id}/users/${kept.id}`);
		const tokens = {
			admin: await accessTokenOf(aegis, application, ADMIN.email, ADMIN.password),
			kept: await accessTokenOf(aegis, application, kept.email, USER_PASSWORD),
			dropped: await accessTokenOf(aegis, application, dropped.email, USER_PASSWORD),
		};

		await admin.put(`/api/applications/${application.id}`, settingsOf({ accessPolicy: "assigned" }));

		expect(await isAccessTokenValid(aegis, tokens.admin)).toBe(true);
		expect(await isAccessTokenValid(aegis, tokens.kept)).toBe(true);
		expect(await isAccessTokenValid(aegis, tokens.dropped)).toBe(false);

		await admin.put(`/api/applications/${application.id}`, settingsOf({ accessPolicy: "everyone" }));
		expect(await isAccessTokenValid(aegis, tokens.kept)).toBe(true);
	});

	test("deletes an application with everything it issued", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		await admin.request("PUT", `/api/applications/${application.id}/logo`, {
			headers: { "content-type": "image/png" },
			payload: await testImage(),
		});
		const { browser } = await signInThrough(aegis, application, ADMIN);
		const token = await accessTokenOf(aegis, application, ADMIN.email, ADMIN.password);
		const pending = aegis.client();
		const { location } = await authorize(pending, application);

		expect((await admin.delete(`/api/applications/${application.id}`)).statusCode).toBe(204);

		expect((await admin.get(`/api/applications/${application.id}`)).statusCode).toBe(404);
		expect(await isAccessTokenValid(aegis, token)).toBe(false);
		expect((await pending.get(`/api/auth/requests/${challengeOf(location)}`)).statusCode).toBe(404);
		expect((await browser.get("/api/auth/session")).statusCode).toBe(200);
		const [deleted] = await auditEvents(aegis, "client.deleted");
		expect(deleted?.client).toMatchObject({ id: null, label: "Wiki" });
	});

	test("ends with 404 when the application is gone meanwhile", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		vi.spyOn(aegis.services.clients, "update").mockResolvedValueOnce(null);

		const response = await admin.put(`/api/applications/${application.id}`, {
			name: "Wiki",
			description: "",
			tokenEndpointAuthMethod: "client_secret_basic",
			redirectUris: [REDIRECT_URI],
			postLogoutRedirectUris: [],
			allowedScopes: ["openid"],
			skipConsent: false,
			enabled: true,
			accessPolicy: "everyone",
			pkcePolicy: "optional",
		});

		expect(response.statusCode).toBe(404);
	});
});

describe("POST /api/applications/:id/secret", () => {
	test("replaces the secret of a confidential client", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const params = {
			grant_type: "authorization_code",
			code,
			redirect_uri: application.redirectUri,
			code_verifier: authorization.verifier,
		};

		const rotated = await admin.post(`/api/applications/${application.id}/secret`);

		const secret = rotated.json().clientSecret as string;
		expect(secret).not.toBe(application.secret);
		expect((await tokenRequest(aegis, application, params)).statusCode).toBe(401);
		expect((await tokenRequest(aegis, { ...application, secret }, params)).statusCode).toBe(200);
		expect(await auditEvents(aegis, "client.secret_rotated")).toHaveLength(1);
	});

	test("does not exist for public clients", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { type: "public" });

		const response = await admin.post(`/api/applications/${application.id}/secret`);

		expect(response.statusCode).toBe(400);
		expect(response.json().error.code).toBe("bad_request");
	});
});
