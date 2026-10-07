import { ACR_VALUES } from "@aegis/contracts";
import { describe, expect, vi } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import {
	answer,
	authorize,
	challengeOf,
	codeOf,
	createApplication,
	exchangeCode,
	signInThrough,
	verifyIdToken,
} from "../../../support/oidc.js";
import { enableTwoFactor, totpCode } from "../../../support/two-factor.js";

describe("GET /api/auth/requests/:challenge", () => {
	test("describes the application and what it asks for", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const browser = aegis.client();
		const { location } = await authorize(browser, application, { scope: "openid email" });

		const response = await browser.get(`/api/auth/requests/${challengeOf(location)}`);

		expect(response.statusCode).toBe(200);
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(response.json()).toEqual({
			type: "sign_in",
			challenge: challengeOf(location),
			instanceName: "Aegis Test",
			client: { id: application.id, name: "Wiki", description: "Team wiki", logoUrl: null, redirectOrigin: "app.aegis.test" },
			emailHint: null,
			reauthenticationRequired: false,
			deniedAccount: null,
			scopes: ["openid", "email"],
			passwordResetEnabled: false,
		});
	});

	test("names the scheme of a native app's redirect", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, {
			type: "public",
			redirectUris: ["com.example.app:/callback"],
			postLogoutRedirectUris: [],
		});
		const browser = aegis.client();
		const { location } = await authorize(browser, application);

		expect((await browser.get(`/api/auth/requests/${challengeOf(location)}`)).json().client.redirectOrigin).toBe("com.example.app");
	});

	test("suggests the address the application passed", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const browser = aegis.client();
		const { location } = await authorize(browser, application, { login_hint: "someone@aegis.test" });

		expect((await browser.get(`/api/auth/requests/${challengeOf(location)}`)).json().emailHint).toBe("someone@aegis.test");
	});

	test("continues with the account signed in in this browser", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { location } = await authorize(admin, application);

		const consent = await answer(admin, await admin.get(`/api/auth/requests/${challengeOf(location)}`));

		expect(consent.pathname).toBe("/consent");
	});

	test("asks for the password again when the application demands a fresh sign-in", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);

		for (const params of [{ prompt: "login" }, { max_age: "0" }]) {
			const { location } = await authorize(admin, application, params);
			const prompt = (await admin.get(`/api/auth/requests/${challengeOf(location)}`)).json();
			expect(prompt).toMatchObject({ type: "sign_in", reauthenticationRequired: true, emailHint: ADMIN.email });
		}
	});

	test("asks for a sign-in when the application expects another account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { location } = await authorize(admin, application, { login_hint: "Someone@Aegis.test" });

		const prompt = (await admin.get(`/api/auth/requests/${challengeOf(location)}`)).json();

		expect(prompt).toMatchObject({
			type: "sign_in",
			reauthenticationRequired: false,
			emailHint: "Someone@Aegis.test",
			deniedAccount: null,
		});
	});

	test("continues when the hint names the signed-in account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { location } = await authorize(admin, application, { login_hint: ADMIN.email.toUpperCase() });

		expect((await admin.get(`/api/auth/requests/${challengeOf(location)}`)).json().type).toBe("redirect");
	});

	test("names the signed-in account that may not use the application", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { accessPolicy: "assigned" });
		const user = await aegis.createUser({ displayName: "Grace" });
		const browser = await aegis.sessionFor(user);
		const { location } = await authorize(browser, application);

		const prompt = (await browser.get(`/api/auth/requests/${challengeOf(location)}`)).json();

		expect(prompt).toMatchObject({
			type: "sign_in",
			emailHint: null,
			deniedAccount: { displayName: "Grace", email: user.email, avatarUrl: null },
		});
	});

	test("rejects an unknown, expired or foreign request", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const browser = aegis.client();
		const { location } = await authorize(browser, application);

		const mismatch = await browser.get("/api/auth/requests/another-challenge");
		expect(mismatch.statusCode).toBe(400);
		expect(mismatch.json().error.code).toBe("auth_request_invalid");

		const foreign = await aegis.client().get(`/api/auth/requests/${challengeOf(location)}`);
		expect(foreign.statusCode).toBe(404);
		expect(foreign.json().error.code).toBe("auth_request_expired");

		expect((await browser.get(`/api/auth/requests/${"x".repeat(129)}`)).statusCode).toBe(404);
	});

	test("rejects a request of an application that was disabled meanwhile", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const browser = aegis.client();
		const { location } = await authorize(browser, application);

		await aegis.services.clients.update(application.id, { enabled: false }, new Date());
		const response = await browser.get(`/api/auth/requests/${challengeOf(location)}`);

		expect(response.statusCode).toBe(400);
		expect(response.json().error).toMatchObject({ code: "auth_request_invalid", message: "Unknown application" });
	});

	test("rejects requests the provider cannot have started", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const browser = aegis.client();
		const { location } = await authorize(browser, application);
		const provider = aegis.services.oidc.requireProvider();
		const details = await provider.interactionDetails.bind(provider);
		const interaction = async (change: (value: Awaited<ReturnType<typeof details>>) => void) => {
			const spy = vi.spyOn(provider, "interactionDetails").mockImplementationOnce(async (req, res) => {
				const value = await details(req, res);
				change(value);
				return value;
			});
			const response = await browser.get(`/api/auth/requests/${challengeOf(location)}`);
			spy.mockRestore();
			return response.json().error.message;
		};

		expect(await interaction((value) => Object.assign(value.prompt, { name: "select_account" }))).toBe("Unsupported prompt");
		expect(await interaction((value) => delete value.params.client_id)).toBe("Unknown application");
	});

	test("is unavailable until the initial setup is complete", async ({ aegis }) => {
		const response = await aegis.client().get("/api/auth/requests/anything");

		expect(response.statusCode).toBe(503);
		expect(response.json().error.code).toBe("setup_required");
	});
});

describe("POST /api/auth/requests/:challenge/sign-in", () => {
	test("rejects a wrong password and records the application", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const browser = aegis.client();
		const { location } = await authorize(browser, application);

		const response = await browser.post(`/api/auth/requests/${challengeOf(location)}/sign-in`, {
			email: ADMIN.email,
			password: "wrong password",
		});

		expect(response.statusCode).toBe(401);
		expect(response.json().error.code).toBe("sign_in_failed");
		const [failed] = await auditEvents(aegis, "auth.sign_in.failed");
		expect(failed).toMatchObject({ client: { id: application.id }, metadata: { reason: "invalid_password", context: "oidc" } });
	});

	test("keeps accounts out of applications they are not assigned to", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { accessPolicy: "assigned" });
		const user = await aegis.createUser();
		const browser = aegis.client();
		const { location } = await authorize(browser, application);

		const denied = await browser.post(`/api/auth/requests/${challengeOf(location)}/sign-in`, {
			email: user.email,
			password: USER_PASSWORD,
		});
		expect(denied.statusCode).toBe(403);
		expect(denied.json().error.code).toBe("application_access_denied");

		await admin.put(`/api/applications/${application.id}/users/${user.id}`);
		const { code } = await signInThrough(aegis, application, { email: user.email, password: USER_PASSWORD });
		expect(code).toBeTruthy();
	});

	test("asks accounts with two-factor authentication for their code", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { secret } = await enableTwoFactor(admin);
		const browser = aegis.client();
		const authorization = await authorize(browser, application, { acr_values: ACR_VALUES.mfa });
		const challenge = challengeOf(authorization.location);

		const prompt = await browser.post(`/api/auth/requests/${challenge}/sign-in`, ADMIN);
		expect(prompt.json()).toMatchObject({ type: "second_factor", account: { email: ADMIN.email }, methods: ["totp", "recovery_code"] });

		const consent = await answer(
			browser,
			await browser.post(`/api/auth/requests/${challenge}/second-factor`, { code: totpCode(secret, 1) }),
		);
		const callback = await answer(browser, await browser.post(`/api/auth/requests/${challengeOf(consent, "/consent")}/consent`));
		const tokens = await exchangeCode(aegis, application, codeOf(authorization, callback, application), authorization.verifier);
		const claims = await verifyIdToken(aegis, application, tokens.id_token, authorization.nonce);
		expect(claims).toMatchObject({ acr: ACR_VALUES.mfa, amr: ["pwd", "otp", "mfa"] });
		const [signedIn] = await auditEvents(aegis, "auth.sign_in.succeeded");
		expect(signedIn).toMatchObject({ client: { id: application.id }, metadata: { context: "oidc", secondFactor: "totp" } });
	});

	test("only answers a pending sign-in", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const browser = aegis.client();
		const { location } = await authorize(browser, application);
		const consent = await answer(browser, await browser.post(`/api/auth/requests/${challengeOf(location)}/sign-in`, ADMIN));

		const signIn = await browser.post(`/api/auth/requests/${challengeOf(consent, "/consent")}/sign-in`, ADMIN);
		const secondFactor = await browser.post(`/api/auth/requests/${challengeOf(consent, "/consent")}/second-factor`, { code: "123456" });

		for (const response of [signIn, secondFactor]) {
			expect(response.statusCode).toBe(400);
			expect(response.json().error).toMatchObject({ code: "auth_request_invalid", message: "No sign-in is pending" });
		}
	});
});

describe("second factor on request of the application", () => {
	test("asks a signed-in account for its code only", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		const { secret } = await enableTwoFactor(admin);
		// Single sign-on with the session confirmed by the password alone.
		const { location: first } = await authorize(admin, application);
		expect(first.pathname).toBe("/sign-in");
		await answer(admin, await admin.get(`/api/auth/requests/${challengeOf(first)}`));

		const authorization = await authorize(admin, application, { acr_values: ACR_VALUES.mfa });
		const challenge = challengeOf(authorization.location);
		const prompt = (await admin.get(`/api/auth/requests/${challenge}`)).json();
		expect(prompt).toMatchObject({ type: "second_factor", challenge, instanceName: "Aegis Test", client: { id: application.id } });

		const wrong = await admin.post(`/api/auth/requests/${challenge}/second-factor`, { code: "000000" });
		expect(wrong.json().error.code).toBe("second_factor_invalid");
		const callback = await answer(
			admin,
			await admin.post(`/api/auth/requests/${challenge}/second-factor`, { code: totpCode(secret, 1) }),
		);
		const tokens = await exchangeCode(aegis, application, codeOf(authorization, callback, application), authorization.verifier);
		expect(await verifyIdToken(aegis, application, tokens.id_token, authorization.nonce)).toMatchObject({ acr: ACR_VALUES.mfa });
	});

	test("lets accounts without a second factor continue, as the acr claim tells", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });

		const authorization = await authorize(admin, application, { acr_values: ACR_VALUES.mfa });
		const callback = await answer(admin, await admin.get(`/api/auth/requests/${challengeOf(authorization.location)}`));
		const tokens = await exchangeCode(aegis, application, codeOf(authorization, callback, application), authorization.verifier);

		expect(await verifyIdToken(aegis, application, tokens.id_token, authorization.nonce)).toMatchObject({
			acr: ACR_VALUES.password,
			amr: ["pwd"],
		});
	});
});

describe("POST /api/auth/requests/:challenge/consent", () => {
	test("requires the account the request belongs to", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const user = await aegis.createUser();
		const browser = aegis.client();
		const { location } = await authorize(browser, application);
		const consent = challengeOf(
			await answer(browser, await browser.post(`/api/auth/requests/${challengeOf(location)}/sign-in`, ADMIN)),
			"/consent",
		);
		const session = browser.cookie(aegis.services.sessionCookie.name) as string;

		browser.deleteCookie(aegis.services.sessionCookie.name);
		expect((await browser.post(`/api/auth/requests/${consent}/consent`)).statusCode).toBe(401);
		expect((await browser.get(`/api/auth/requests/${consent}`)).statusCode).toBe(401);

		const other = await aegis.sessionFor(user);
		browser.setCookie(aegis.services.sessionCookie.name, other.cookie(aegis.services.sessionCookie.name) as string);
		const foreign = await browser.post(`/api/auth/requests/${consent}/consent`);
		expect(foreign.statusCode).toBe(400);
		expect(foreign.json().error.message).toBe("No consent is pending for this account");

		browser.setCookie(aegis.services.sessionCookie.name, session);
		expect((await browser.post(`/api/auth/requests/${consent}/consent`)).statusCode).toBe(200);
	});

	test("is refused once the account lost access to the application", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const user = await aegis.createUser();
		const browser = aegis.client();
		const { location } = await authorize(browser, application);
		const signIn = await browser.post(`/api/auth/requests/${challengeOf(location)}/sign-in`, {
			email: user.email,
			password: USER_PASSWORD,
		});
		const consent = challengeOf(await answer(browser, signIn), "/consent");

		await aegis.services.clients.update(application.id, { accessPolicy: "assigned" }, new Date());

		const response = await browser.post(`/api/auth/requests/${consent}/consent`);
		expect(response.statusCode).toBe(403);
		expect(response.json().error.code).toBe("application_access_denied");
	});

	test("only answers a pending consent", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { location } = await authorize(admin, application, { prompt: "login" });

		const response = await admin.post(`/api/auth/requests/${challengeOf(location)}/consent`);

		expect(response.statusCode).toBe(400);
		expect(response.json().error.message).toBe("No consent is pending for this account");
	});
});

describe("POST /api/auth/requests/:challenge/cancel", () => {
	test("returns access_denied to the application, at either prompt", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);

		const anonymous = aegis.client();
		const signIn = await authorize(anonymous, application);
		const cancelled = await answer(anonymous, await anonymous.post(`/api/auth/requests/${challengeOf(signIn.location)}/cancel`));
		expect(cancelled.searchParams.get("error")).toBe("access_denied");
		expect(cancelled.searchParams.get("state")).toBe(signIn.state);

		const consent = await authorize(admin, application);
		const consentChallenge = challengeOf(
			await answer(admin, await admin.get(`/api/auth/requests/${challengeOf(consent.location)}`)),
			"/consent",
		);
		const declined = await answer(admin, await admin.post(`/api/auth/requests/${consentChallenge}/cancel`));
		expect(declined.searchParams.get("error")).toBe("access_denied");

		const events = await auditEvents(aegis, "oidc.authorization.cancelled");
		expect(events.map((event) => [event.actor?.label ?? null, event.metadata.prompt])).toEqual([
			[ADMIN.email, "consent"],
			[null, "sign_in"],
		]);
	});
});
