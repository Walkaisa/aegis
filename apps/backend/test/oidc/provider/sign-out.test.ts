import { describe, expect, vi } from "vitest";
import { ADMIN, test } from "../../support/aegis.js";
import { auditEvents, awaitAuditEvent } from "../../support/audit.js";
import { createApplication, exchangeCode, follow, locationOf, POST_LOGOUT_REDIRECT_URI, signInThrough } from "../../support/oidc.js";

describe("sign-out", () => {
	test("asks for confirmation, ends the session and returns to the application", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { browser, authorization, code } = await signInThrough(aegis, application, ADMIN);
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);
		const query = new URLSearchParams({
			id_token_hint: tokens.id_token,
			post_logout_redirect_uri: POST_LOGOUT_REDIRECT_URI,
			state: "bye",
		});

		const page = await browser.get(`/oauth2/sign-out?${query}`, { headers: { "accept-language": "de" } });
		expect(page.statusCode).toBe(200);
		expect(page.headers["content-type"]).toMatch(/^text\/html/);
		expect(page.headers["cache-control"]).toBe("no-store");
		expect(page.headers["content-security-policy"]).toContain("default-src 'none'");
		expect(page.body).toContain('<html lang="de">');
		expect(page.body).toContain("„Wiki“ möchte dich von Aegis Test abmelden.");
		const xsrf = /name="xsrf" value="([^"]+)"/.exec(page.body)?.[1] ?? "";

		const confirmed = await browser.request("POST", "/oauth2/sign-out/confirm", {
			headers: { "content-type": "application/x-www-form-urlencoded" },
			payload: new URLSearchParams({ xsrf, logout: "yes" }).toString(),
		});
		const returned = locationOf(confirmed);
		expect(`${returned.origin}${returned.pathname}`).toBe(POST_LOGOUT_REDIRECT_URI);
		expect(returned.searchParams.get("state")).toBe("bye");
		expect(browser.cookie(aegis.services.sessionCookie.name)).toBeUndefined();
		const signedOut = await awaitAuditEvent(aegis, "oidc.sign_out");
		expect(signedOut).toMatchObject({ actor: { label: ADMIN.email }, client: { id: application.id } });
		await vi.waitFor(async () => {
			expect(await aegis.services.sessions.listByClient(application.id, new Date())).toEqual([]);
		});
		expect((await admin.get("/api/auth/session")).statusCode).toBe(200);
	});

	test("keeps the Aegis session when the user stays signed in", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { browser } = await signInThrough(aegis, application, ADMIN);
		await vi.waitFor(async () => expect(await aegis.services.sessions.listByClient(application.id, new Date())).toHaveLength(1));

		const page = await browser.get(`/oauth2/sign-out?client_id=${application.id}`, { headers: { "accept-language": "en" } });
		expect(page.body).toContain("“Wiki” wants to sign you out of Aegis Test.");
		const xsrf = /name="xsrf" value="([^"]+)"/.exec(page.body)?.[1] ?? "";
		const stayed = await browser.request("POST", "/oauth2/sign-out/confirm", {
			headers: { "content-type": "application/x-www-form-urlencoded" },
			payload: new URLSearchParams({ xsrf }).toString(),
		});

		expect((await follow(browser, locationOf(stayed))).pathname).toBe("/signed-out");
		expect((await browser.get("/api/auth/session")).statusCode).toBe(200);
		await vi.waitFor(async () => expect(await aegis.services.sessions.listByClient(application.id, new Date())).toEqual([]));
		expect(await auditEvents(aegis, "oidc.sign_out")).toEqual([]);
	});

	test("asks without naming an application when none is known", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { browser } = await signInThrough(aegis, application, ADMIN);

		const page = await browser.get("/oauth2/sign-out");
		expect(page.body).toContain("Do you want to sign out of Aegis Test?");
		const xsrf = /name="xsrf" value="([^"]+)"/.exec(page.body)?.[1] ?? "";
		const confirmed = await browser.request("POST", "/oauth2/sign-out/confirm", {
			headers: { "content-type": "application/x-www-form-urlencoded" },
			payload: new URLSearchParams({ xsrf, logout: "yes" }).toString(),
		});

		expect((await follow(browser, locationOf(confirmed))).pathname).toBe("/signed-out");
		expect((await browser.get("/api/auth/session")).statusCode).toBe(401);
		expect(await awaitAuditEvent(aegis, "oidc.sign_out")).toMatchObject({ actor: { label: ADMIN.email }, client: null });
	});

	test("signs out a browser that holds no Aegis session any more", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { browser } = await signInThrough(aegis, application, ADMIN);
		browser.deleteCookie(aegis.services.sessionCookie.name);

		const page = await browser.get(`/oauth2/sign-out?client_id=${application.id}`);
		const xsrf = /name="xsrf" value="([^"]+)"/.exec(page.body)?.[1] ?? "";
		await browser.request("POST", "/oauth2/sign-out/confirm", {
			headers: { "content-type": "application/x-www-form-urlencoded" },
			payload: new URLSearchParams({ xsrf, logout: "yes" }).toString(),
		});

		expect(await awaitAuditEvent(aegis, "oidc.sign_out")).toMatchObject({ actor: null, subject: null, client: { id: application.id } });
	});
});
