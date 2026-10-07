import { ACR_VALUES } from "@aegis/contracts";
import { describe, expect, vi } from "vitest";
import { ADMIN, ISSUER, test } from "../../support/aegis.js";
import { auditEvents, awaitAuditEvent, awaitAuditEvents } from "../../support/audit.js";
import { testImage } from "../../support/images.js";
import {
	answer,
	authorize,
	challengeOf,
	codeOf,
	createApplication,
	exchangeCode,
	locationOf,
	signInThrough,
	tokenRequest,
	userinfo,
	verifyIdToken,
} from "../../support/oidc.js";

describe("authorization code flow", () => {
	test("signs in, asks for consent once and issues tokens the application can verify", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const account = (await admin.get("/api/auth/session")).json().account;

		const browser = aegis.client();
		const authorization = await authorize(browser, application);
		const signInChallenge = challengeOf(authorization.location);
		const consent = await answer(browser, await browser.post(`/api/auth/requests/${signInChallenge}/sign-in`, ADMIN));
		const prompt = (await browser.get(`/api/auth/requests/${challengeOf(consent, "/consent")}`)).json();
		expect(prompt).toMatchObject({ type: "consent", scopes: ["openid", "profile", "email"], account: { email: ADMIN.email } });
		const callback = await answer(browser, await browser.post(`/api/auth/requests/${challengeOf(consent, "/consent")}/consent`));
		const tokens = await exchangeCode(aegis, application, codeOf(authorization, callback, application), authorization.verifier);

		expect(tokens).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "openid profile email" });
		expect(tokens).not.toHaveProperty("refresh_token");
		const claims = await verifyIdToken(aegis, application, tokens.id_token, authorization.nonce);
		expect(claims).toMatchObject({
			sub: account.id,
			email: ADMIN.email,
			email_verified: true,
			name: ADMIN.displayName,
			acr: ACR_VALUES.password,
			amr: ["pwd"],
			auth_time: expect.any(Number),
			updated_at: expect.any(Number),
		});
		expect(claims).not.toHaveProperty("picture");
		expect((await userinfo(aegis, tokens.access_token)).json()).toEqual({
			sub: account.id,
			email: ADMIN.email,
			email_verified: true,
			name: ADMIN.displayName,
			updated_at: claims.updated_at,
		});

		const [granted] = await auditEvents(aegis, "oidc.consent.granted");
		expect(granted).toMatchObject({ client: { id: application.id }, metadata: { scopes: ["openid", "profile", "email"] } });
		expect(await awaitAuditEvent(aegis, "oidc.authorization.succeeded")).toMatchObject({
			actor: { id: account.id },
			client: { id: application.id },
		});
		await vi.waitFor(async () => {
			const sessions = (await admin.get(`/api/applications/${application.id}/sessions`)).json().sessions;
			expect(sessions).toEqual([expect.objectContaining({ account: expect.objectContaining({ id: account.id }) })]);
		});

		// Single sign-on: the next request of the application needs neither a password nor a consent.
		const again = await authorize(browser, application);
		expect(codeOf(again, again.location, application)).toBeTruthy();
	});

	test("remembers the consent for the next browser of the account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		await signInThrough(aegis, application, ADMIN);

		const browser = aegis.client();
		const authorization = await authorize(browser, application);
		const location = await answer(
			browser,
			await browser.post(`/api/auth/requests/${challengeOf(authorization.location)}/sign-in`, ADMIN),
		);

		expect(codeOf(authorization, location, application)).toBeTruthy();
		expect(await auditEvents(aegis, "oidc.consent.granted")).toHaveLength(1);
	});

	test("asks again for scopes the account has not approved yet", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		await signInThrough(aegis, application, ADMIN, { params: { scope: "openid email" } });

		const browser = aegis.client();
		const authorization = await authorize(browser, application);
		const consent = await answer(
			browser,
			await browser.post(`/api/auth/requests/${challengeOf(authorization.location)}/sign-in`, ADMIN),
		);

		expect((await browser.get(`/api/auth/requests/${challengeOf(consent, "/consent")}`)).json().scopes).toEqual(["profile"]);
		await answer(browser, await browser.post(`/api/auth/requests/${challengeOf(consent, "/consent")}/consent`));
		expect((await auditEvents(aegis, "oidc.consent.granted")).map((event) => event.metadata.scopes)).toEqual([
			["openid", "email", "profile"],
			["openid", "email"],
		]);
	});

	test("lets trusted web applications skip the consent, but never native apps", async ({ aegis }) => {
		const admin = await aegis.setup();
		const trusted = await createApplication(admin, { skipConsent: true });
		const native = await createApplication(admin, {
			name: "Mobile",
			type: "public",
			redirectUris: ["com.example.app:/callback"],
			postLogoutRedirectUris: [],
			skipConsent: true,
		});

		const { code } = await signInThrough(aegis, trusted, ADMIN);
		expect(code).toBeTruthy();
		expect(await auditEvents(aegis, "oidc.consent.granted")).toEqual([]);
		expect(await aegis.services.consents.find((await admin.get("/api/auth/session")).json().account.id, trusted.id)).toEqual([
			"openid",
			"profile",
			"email",
		]);

		const browser = aegis.client();
		const authorization = await authorize(browser, native);
		const consent = await answer(
			browser,
			await browser.post(`/api/auth/requests/${challengeOf(authorization.location)}/sign-in`, ADMIN),
		);
		expect(consent.pathname).toBe("/consent");
	});

	test("keeps applications to the scopes they may request", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { allowedScopes: ["openid", "email"] });

		const disallowed = await authorize(aegis.client(), application, { scope: "openid email profile" });
		expect(disallowed.location.searchParams.get("error")).toBe("invalid_scope");

		const { authorization, code } = await signInThrough(aegis, application, ADMIN, {
			params: { scope: "openid email offline_access" },
		});
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);

		expect(tokens.scope).toBe("openid email");
		const claims = await userinfo(aegis, tokens.access_token);
		expect(claims.json()).toHaveProperty("email");
		expect(claims.json()).not.toHaveProperty("name");
	});

	test("authenticates confidential clients with client_secret_post", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { tokenEndpointAuthMethod: "client_secret_post" });
		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const params = {
			grant_type: "authorization_code",
			code,
			redirect_uri: application.redirectUri,
			code_verifier: authorization.verifier,
		};

		expect((await tokenRequest(aegis, application, params, "client_secret_post")).statusCode).toBe(200);
		expect((await admin.get(`/api/applications/${application.id}`)).json().client.tokenEndpointAuthMethod).toBe("client_secret_post");
	});

	test("never issues refresh tokens", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { authorization, code } = await signInThrough(aegis, application, ADMIN, {
			params: { scope: "openid offline_access", prompt: "consent" },
		});

		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);
		expect(tokens).not.toHaveProperty("refresh_token");
		const refresh = await tokenRequest(aegis, application, { grant_type: "refresh_token", refresh_token: "anything" });
		expect(refresh.json().error).toBe("unsupported_grant_type");
	});

	test("rejects a wrong client secret, a wrong verifier and a code used twice", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const params = {
			grant_type: "authorization_code",
			code,
			redirect_uri: application.redirectUri,
			code_verifier: authorization.verifier,
		};

		const wrongSecret = await tokenRequest(aegis, { ...application, secret: "wrong" }, params);
		expect(wrongSecret.statusCode).toBe(401);
		expect(wrongSecret.json().error).toBe("invalid_client");

		const wrongVerifier = await tokenRequest(aegis, application, { ...params, code_verifier: "x".repeat(43) });
		expect(wrongVerifier.json().error).toBe("invalid_grant");

		// A failed exchange does not burn the code, but a successful one does.
		expect((await tokenRequest(aegis, application, params)).statusCode).toBe(200);
		expect((await tokenRequest(aegis, application, params)).json().error).toBe("invalid_grant");
		const failed = await awaitAuditEvents(aegis, "oidc.token.failed", 3);
		expect(failed.map((event) => event.metadata.error).sort()).toEqual(["invalid_client", "invalid_grant", "invalid_grant"]);
		expect(failed.every((event) => event.metadata.grantType === "authorization_code")).toBe(true);
	});

	test("lets public clients exchange the code with PKCE only, from their own origin", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, {
			name: "SPA",
			type: "public",
			redirectUris: ["http://localhost:5173/callback"],
		});
		expect(application.secret).toBeNull();

		const withoutChallenge = await authorize(aegis.client(), application, {
			code_challenge: undefined,
			code_challenge_method: undefined,
		});
		expect(withoutChallenge.location.searchParams.get("error")).toBe("invalid_request");

		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const params = {
			grant_type: "authorization_code",
			code,
			redirect_uri: application.redirectUri,
			code_verifier: authorization.verifier,
		};
		const response = await aegis.app.inject({
			method: "POST",
			url: "/oauth2/token",
			headers: { host: new URL(ISSUER).host, origin: "http://localhost:5173", "content-type": "application/x-www-form-urlencoded" },
			payload: new URLSearchParams({ ...params, client_id: application.id }).toString(),
		});
		expect(response.statusCode).toBe(200);
		expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
	});

	test("never lets confidential clients use the token endpoint from a browser", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const basic = Buffer.from(`${application.id}:${application.secret}`).toString("base64");
		const request = (origin: string) =>
			aegis.app.inject({
				method: "POST",
				url: "/oauth2/token",
				headers: {
					host: new URL(ISSUER).host,
					origin,
					authorization: `Basic ${basic}`,
					"content-type": "application/x-www-form-urlencoded",
				},
				payload: new URLSearchParams({
					grant_type: "authorization_code",
					code,
					redirect_uri: application.redirectUri,
					code_verifier: authorization.verifier,
				}).toString(),
			});

		expect((await request("https://app.aegis.test")).headers["access-control-allow-origin"]).toBeUndefined();
		expect((await request("null")).headers["access-control-allow-origin"]).toBeUndefined();
	});

	test("follows the PKCE policy of confidential clients", async ({ aegis }) => {
		const admin = await aegis.setup();
		const required = await createApplication(admin, { name: "Required", pkcePolicy: "required" });
		const disabled = await createApplication(admin, { name: "Disabled", pkcePolicy: "disabled" });
		const noPkce = { code_challenge: undefined, code_challenge_method: undefined };

		const rejected = await authorize(aegis.client(), required, noPkce);
		expect(rejected.location.searchParams.get("error")).toBe("invalid_request");
		const plain = await authorize(aegis.client(), required, { code_challenge_method: "plain" });
		expect(plain.location.searchParams.get("error")).toBe("invalid_request");

		const { code } = await signInThrough(aegis, disabled, ADMIN, { params: noPkce });
		const tokens = await tokenRequest(aegis, disabled, { grant_type: "authorization_code", code, redirect_uri: disabled.redirectUri });
		expect(tokens.statusCode).toBe(200);
	});

	test("never redirects to an unregistered URI or for an unknown application", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const disabled = await createApplication(admin, { name: "Disabled" });
		await admin.put(`/api/applications/${disabled.id}`, {
			name: "Disabled",
			description: "",
			tokenEndpointAuthMethod: "client_secret_basic",
			redirectUris: [disabled.redirectUri],
			postLogoutRedirectUris: [],
			allowedScopes: ["openid"],
			skipConsent: false,
			enabled: false,
			accessPolicy: "everyone",
			pkcePolicy: "optional",
		});

		const unregistered = await authorize(aegis.client(), application, { redirect_uri: "https://evil.aegis.test/callback" });
		expect(`${unregistered.location.origin}${unregistered.location.pathname}`).toBe(`${ISSUER}/error`);
		expect(unregistered.location.searchParams.get("error")).toBe("invalid_redirect_uri");
		const failed = await awaitAuditEvent(aegis, "oidc.authorization.failed");
		expect(failed).toMatchObject({
			client: { id: application.id },
			metadata: { error: "invalid_redirect_uri", clientId: application.id, redirectUri: "https://evil.aegis.test/callback" },
		});

		for (const clientId of [disabled.id, "1", "unknown"]) {
			const unknown = await authorize(aegis.client(), { ...application, id: clientId });
			expect(unknown.location.pathname).toBe("/error");
			expect(unknown.location.searchParams.get("error")).toBe("invalid_client");
		}
		const withoutClient = await aegis.client().get("/oauth2/authorize?response_type=code");
		expect(locationOf(withoutClient).searchParams.get("error")).toBe("invalid_request");
	});

	test("puts an absolute picture URL into the claims", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		await admin.request("PUT", "/api/account/avatar", { headers: { "content-type": "image/png" }, payload: await testImage() });
		const { avatarUrl } = (await admin.get("/api/auth/session")).json().account;

		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);

		expect((await userinfo(aegis, tokens.access_token)).json().picture).toBe(`${ISSUER}${avatarUrl}`);
	});

	test("answers prompt=none without a session with login_required", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);

		const { location } = await authorize(aegis.client(), application, { prompt: "none" });

		expect(location.searchParams.get("error")).toBe("login_required");
	});
});
