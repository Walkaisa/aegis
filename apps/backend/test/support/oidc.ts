import { createHash, randomBytes } from "node:crypto";
import type { ClientCreateRequest, ClientWithSecretResponse } from "@aegis/contracts";
import type { LightMyRequestResponse as Response } from "fastify";
import { createLocalJWKSet, type JWTPayload, jwtVerify } from "jose";
import { expect } from "vitest";
import { ISSUER, type TestAegis } from "./aegis.js";
import type { TestClient } from "./client.js";

const ISSUER_HOST = new URL(ISSUER).host;

export const REDIRECT_URI = "https://app.aegis.test/callback";
export const POST_LOGOUT_REDIRECT_URI = "https://app.aegis.test/signed-out";

export interface TestApplication {
	id: string;
	secret: string | null;
	redirectUri: string;
}

type ApplicationInput = Omit<ClientCreateRequest, "accessPolicy" | "pkcePolicy"> &
	Partial<Pick<ClientCreateRequest, "accessPolicy" | "pkcePolicy">>;

/** Settings of a confidential web application, as an admin creates it. */
export function applicationInput(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
	return {
		name: "Wiki",
		description: "Team wiki",
		type: "confidential",
		tokenEndpointAuthMethod: "client_secret_basic",
		redirectUris: [REDIRECT_URI],
		postLogoutRedirectUris: [POST_LOGOUT_REDIRECT_URI],
		allowedScopes: ["openid", "profile", "email"],
		skipConsent: false,
		...overrides,
	};
}

/** Creates an application through the API with the signed-in admin browser. */
export async function createApplication(admin: TestClient, overrides: Partial<ApplicationInput> = {}): Promise<TestApplication> {
	const input = applicationInput(overrides);
	const response = await admin.post("/api/applications", input);
	expect(response.statusCode).toBe(201);
	const { client, clientSecret } = response.json() as ClientWithSecretResponse;
	return { id: client.id, secret: clientSecret, redirectUri: input.redirectUris[0] ?? REDIRECT_URI };
}

/** The `Location` of a redirect, resolved against the issuer. */
export function locationOf(response: Response): URL {
	expect(response.statusCode, response.body).toBeGreaterThanOrEqual(300);
	expect(response.statusCode, response.body).toBeLessThan(400);
	return new URL(String(response.headers.location), ISSUER);
}

/** An authorization request in flight: the values the application keeps until the code comes back. */
export interface Authorization {
	state: string;
	nonce: string;
	verifier: string;
	/** Where the browser was sent: a page of the web UI, or the application with a code or an error. */
	location: URL;
}

/** A PKCE verifier and its S256 challenge. */
export function pkcePair(): { verifier: string; challenge: string } {
	const verifier = randomBytes(32).toString("base64url");
	return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

/**
 * Starts the authorization code flow with PKCE in the browser, as a relying party does, and follows
 * the redirects of the provider. `params` adds or overrides parameters; `undefined` removes one.
 */
export async function authorize(
	browser: TestClient,
	application: TestApplication,
	params: Record<string, string | undefined> = {},
): Promise<Authorization> {
	const { verifier, challenge } = pkcePair();
	const state = randomBytes(8).toString("hex");
	const nonce = randomBytes(8).toString("hex");
	const query = new URLSearchParams();
	const all: Record<string, string | undefined> = {
		client_id: application.id,
		redirect_uri: application.redirectUri,
		response_type: "code",
		scope: "openid profile email",
		state,
		nonce,
		code_challenge: challenge,
		code_challenge_method: "S256",
		...params,
	};
	for (const [name, value] of Object.entries(all)) {
		if (value !== undefined) {
			query.set(name, value);
		}
	}

	const location = await follow(browser, locationOf(await browser.get(`/oauth2/authorize?${query}`)));
	return { state, nonce, verifier, location };
}

/** Follows redirects inside the provider until the browser reaches a page or leaves Aegis. */
export async function follow(browser: TestClient, target: string | URL): Promise<URL> {
	let url = new URL(target, ISSUER);
	while (url.origin === ISSUER && url.pathname.startsWith("/oauth2/")) {
		url = locationOf(await browser.get(`${url.pathname}${url.search}`));
	}
	return url;
}

/** The `challenge` of the sign-in or consent page the browser was sent to. */
export function challengeOf(location: URL, page: "/sign-in" | "/consent" = "/sign-in"): string {
	expect(location.pathname).toBe(page);
	const challenge = location.searchParams.get("challenge");
	expect(challenge).toBeTruthy();
	return challenge as string;
}

/** Answers a sign-in or consent prompt with the API of the web UI and follows the returned redirect. */
export async function answer(browser: TestClient, response: Response): Promise<URL> {
	expect(response.statusCode, response.body).toBe(200);
	const body = response.json() as { type: string; redirectTo?: string };
	expect(body.type).toBe("redirect");
	return follow(browser, body.redirectTo as string);
}

/** The authorization code the application received, after checking `state`. */
export function codeOf(authorization: Pick<Authorization, "state">, location: URL, application: TestApplication): string {
	expect(`${location.origin}${location.pathname}`).toBe(application.redirectUri);
	expect(location.searchParams.get("error"), location.searchParams.get("error_description") ?? "").toBeNull();
	expect(location.searchParams.get("state")).toBe(authorization.state);
	return location.searchParams.get("code") as string;
}

/**
 * Signs in through the application in a fresh browser (password, consent) and returns the browser,
 * the authorization and the code the application received.
 */
export async function signInThrough(
	aegis: TestAegis,
	application: TestApplication,
	account: { email: string; password: string },
	options: { browser?: TestClient; params?: Record<string, string | undefined> } = {},
): Promise<{ browser: TestClient; authorization: Authorization; code: string }> {
	const browser = options.browser ?? aegis.client();
	const authorization = await authorize(browser, application, options.params);
	let location = authorization.location;

	if (location.pathname === "/sign-in") {
		const challenge = challengeOf(location);
		location = await answer(browser, await browser.post(`/api/auth/requests/${challenge}/sign-in`, account));
	}
	if (location.pathname === "/consent") {
		const challenge = challengeOf(location, "/consent");
		location = await answer(browser, await browser.post(`/api/auth/requests/${challenge}/consent`));
	}

	const code = codeOf(authorization, location, application);
	return { browser, authorization: { ...authorization, location }, code };
}

/** A request of the application to an endpoint of the provider, authenticated like the application does. */
export function tokenRequest(
	aegis: TestAegis,
	application: TestApplication,
	params: Record<string, string>,
	auth: "client_secret_basic" | "client_secret_post" | "none" = application.secret ? "client_secret_basic" : "none",
	path = "/oauth2/token",
): Promise<Response> {
	const form = new URLSearchParams(params);
	const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
	if (auth === "client_secret_basic") {
		const credentials = `${encodeURIComponent(application.id)}:${encodeURIComponent(application.secret ?? "")}`;
		headers.authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
	} else if (auth === "client_secret_post") {
		form.set("client_id", application.id);
		form.set("client_secret", application.secret ?? "");
	} else {
		form.set("client_id", application.id);
	}
	// The application's back channel: no cookies of any browser.
	return aegis.app.inject({
		method: "POST",
		url: path,
		headers: { host: ISSUER_HOST, ...headers },
		payload: form.toString(),
		remoteAddress: "10.255.0.1",
	});
}

export interface TokenSet {
	access_token: string;
	id_token: string;
	token_type: string;
	expires_in: number;
	scope: string;
}

/** Exchanges the code at the token endpoint and returns the tokens. */
export async function exchangeCode(aegis: TestAegis, application: TestApplication, code: string, verifier: string): Promise<TokenSet> {
	const response = await tokenRequest(aegis, application, {
		grant_type: "authorization_code",
		code,
		redirect_uri: application.redirectUri,
		code_verifier: verifier,
	});
	expect(response.statusCode, response.body).toBe(200);
	return response.json() as TokenSet;
}

/**
 * Verifies an ID token as a relying party does: signature against the published key set, issuer,
 * audience, algorithm and the nonce of the request. Returns its claims.
 */
export async function verifyIdToken(aegis: TestAegis, application: TestApplication, idToken: string, nonce: string): Promise<JWTPayload> {
	const jwks = (await aegis.app.inject({ method: "GET", url: "/.well-known/jwks.json" })).json();
	const { payload } = await jwtVerify(idToken, createLocalJWKSet(jwks), {
		issuer: ISSUER,
		audience: application.id,
		algorithms: ["RS256"],
	});
	expect(payload.nonce).toBe(nonce);
	return payload;
}

/** Calls the userinfo endpoint with an access token. */
export function userinfo(aegis: TestAegis, accessToken: string): Promise<Response> {
	return aegis.app.inject({
		method: "GET",
		url: "/oauth2/userinfo",
		headers: { host: ISSUER_HOST, authorization: `Bearer ${accessToken}` },
	});
}

/** Signs the account in to the application and returns its access token. */
export async function accessTokenOf(aegis: TestAegis, application: TestApplication, email: string, password: string): Promise<string> {
	const { authorization, code } = await signInThrough(aegis, application, { email, password });
	return (await exchangeCode(aegis, application, code, authorization.verifier)).access_token;
}

/** Whether the provider still accepts the access token. */
export async function isAccessTokenValid(aegis: TestAegis, accessToken: string): Promise<boolean> {
	return (await userinfo(aegis, accessToken)).statusCode === 200;
}
