import { createHash, randomBytes } from "node:crypto";
import { type APIRequestContext, type Page, request } from "@playwright/test";
import { ADMIN_STATE, createUser, USER_PASSWORD } from "./support/accounts";
import { expect, test } from "./support/test";

/** The application under an address no server answers; the test stands in for it, see `standInForApplication`. */
const APP = "https://wiki.aegis.test";
const REDIRECT_URI = `${APP}/callback`;
const POST_LOGOUT_REDIRECT_URI = `${APP}/signed-out`;

interface Application {
	id: string;
	secret: string;
}

async function createApplication(api: APIRequestContext): Promise<Application> {
	const response = await api.post("/api/applications", {
		data: {
			name: "Wiki",
			description: "Team wiki",
			type: "confidential",
			tokenEndpointAuthMethod: "client_secret_basic",
			redirectUris: [REDIRECT_URI],
			postLogoutRedirectUris: [POST_LOGOUT_REDIRECT_URI],
			allowedScopes: ["openid", "profile", "email"],
			skipConsent: false,
		},
	});
	expect(response.status()).toBe(201);
	const { client, clientSecret } = await response.json();
	return { id: client.id, secret: clientSecret };
}

/** Starts an authorization code flow with PKCE the way a web application does. */
function authorizationRequest(application: Application) {
	const verifier = randomBytes(32).toString("base64url");
	const state = randomBytes(16).toString("base64url");
	const nonce = randomBytes(16).toString("base64url");
	const url = new URL("/oauth2/authorize", "http://placeholder");
	url.search = new URLSearchParams({
		client_id: application.id,
		redirect_uri: REDIRECT_URI,
		response_type: "code",
		scope: "openid profile email",
		state,
		nonce,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
	}).toString();
	return { path: `${url.pathname}${url.search}`, verifier, state, nonce };
}

/**
 * Stands in for the application. Pages of Aegis that send the browser on to the application are
 * answered with a page of the application instead, so the browser stays where the test can see it,
 * and `arrivalAfter` returns the address the application was sent.
 */
async function standInForApplication(page: Page, baseURL: string) {
	const arrivals: URL[] = [];
	await page.route(
		(url) => url.origin === new URL(baseURL).origin,
		async (route) => {
			if (!route.request().isNavigationRequest()) {
				return route.fallback();
			}
			const response = await route.fetch({ maxRedirects: 0 });
			const location = response.headers().location;
			if (!location?.startsWith(APP)) {
				return route.fulfill({ response });
			}
			arrivals.push(new URL(location));
			return route.fulfill({ status: 200, contentType: "text/html", body: "<h1>Wiki</h1>" });
		},
	);

	/** Where the application is sent while `action` runs. */
	return async function arrivalAfter(action: () => Promise<unknown>): Promise<URL> {
		const before = arrivals.length;
		await action();
		await expect.poll(() => arrivals.length).toBe(before + 1);
		const arrival = arrivals[before];
		if (!arrival) {
			throw new Error("The application was not reached");
		}
		return arrival;
	};
}

/** The code the browser brings back to the application, after checking the state. */
function codeOf(callback: URL, state: string): string {
	expect(callback.pathname).toBe(new URL(REDIRECT_URI).pathname);
	expect(callback.searchParams.get("state")).toBe(state);
	return callback.searchParams.get("code") ?? "";
}

const claimsOf = (jwt: string) => JSON.parse(Buffer.from(jwt.split(".")[1] ?? "", "base64url").toString("utf8"));

test.describe("single sign-on", () => {
	let application: Application;
	let user: { id: string; email: string };

	test.beforeAll(async ({ baseURL }) => {
		const api = await request.newContext({ baseURL, storageState: ADMIN_STATE });
		application = await createApplication(api);
		user = await createUser(api);
		await api.dispose();
	});

	test("a user signs in to an application, allows access and the application gets their identity", async ({ page, request, baseURL }) => {
		const arrivalAfter = await standInForApplication(page, baseURL ?? "");
		const authorization = authorizationRequest(application);

		await page.goto(authorization.path);
		await expect(page.getByText("Sign in to continue to Wiki.")).toBeVisible();
		await page.getByLabel("Email address").fill(user.email);
		await page.getByLabel("Password", { exact: true }).fill(USER_PASSWORD);
		await page.getByRole("button", { name: "Continue" }).click();

		await expect(page.getByRole("heading", { name: "Wiki wants to access your account" })).toBeVisible();
		const code = codeOf(await arrivalAfter(() => page.getByRole("button", { name: "Allow" }).click()), authorization.state);
		expect(code).not.toBe("");
		await expect(page.getByRole("heading", { name: "Wiki" })).toBeVisible();

		const tokens = await request.post("/oauth2/token", {
			headers: { authorization: `Basic ${Buffer.from(`${application.id}:${application.secret}`).toString("base64")}` },
			form: { grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier: authorization.verifier },
		});
		expect(tokens.status()).toBe(200);
		const { id_token: idToken, access_token: accessToken, refresh_token: refreshToken } = await tokens.json();
		expect(refreshToken).toBeUndefined();
		expect(claimsOf(idToken)).toMatchObject({ iss: baseURL, aud: application.id, sub: user.id, nonce: authorization.nonce });

		const userinfo = await request.get("/oauth2/userinfo", { headers: { authorization: `Bearer ${accessToken}` } });
		expect(await userinfo.json()).toMatchObject({ sub: user.id, email: user.email, name: "Grace Hopper" });

		// The code works once.
		const replay = await request.post("/oauth2/token", {
			headers: { authorization: `Basic ${Buffer.from(`${application.id}:${application.secret}`).toString("base64")}` },
			form: { grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier: authorization.verifier },
		});
		expect(replay.status()).toBe(400);

		// Signed in and allowed once, the next sign-in of the application needs no prompt at all.
		const again = authorizationRequest(application);
		expect(codeOf(await arrivalAfter(() => page.goto(again.path)), again.state)).not.toBe("");

		// Signing out from the application ends the session at Aegis after a confirmation.
		await page.goto(
			`/oauth2/sign-out?${new URLSearchParams({ id_token_hint: idToken, post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI })}`,
		);
		const signedOut = await arrivalAfter(() => page.getByRole("button", { name: "Sign out" }).click());
		expect(signedOut.href).toBe(POST_LOGOUT_REDIRECT_URI);

		const afterSignOut = authorizationRequest(application);
		await page.goto(afterSignOut.path);
		await expect(page.getByText("Sign in to continue to Wiki.")).toBeVisible();
	});

	test("a request that does not match the application ends on the error page, not at the redirect URI", async ({ page }) => {
		const authorization = authorizationRequest(application);

		await page.goto(
			authorization.path.replace(encodeURIComponent(REDIRECT_URI), encodeURIComponent("https://evil.aegis.test/callback")),
		);

		await expect(page).toHaveURL(/\/error\?/);
		await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	});

	test("a wrong password keeps the user on the sign-in page of the application", async ({ page }) => {
		await page.goto(authorizationRequest(application).path);
		await page.getByLabel("Email address").fill(user.email);
		await page.getByLabel("Password", { exact: true }).fill("not the password");
		await page.getByRole("button", { name: "Continue" }).click();

		await expect(page.getByRole("alert")).toBeVisible();
		await expect(page).toHaveURL(/\/sign-in\?challenge=/);
	});
});
