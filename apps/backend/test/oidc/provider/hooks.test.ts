import type { Client } from "oidc-provider";
import { describe, expect, vi } from "vitest";
import { clientBasedCors, loadExistingGrant, mayUseClient, renderError } from "../../../src/oidc/provider.js";
import { type TestAegis, test } from "../../support/aegis.js";
import { auditEvents } from "../../support/audit.js";
import { createApplication } from "../../support/oidc.js";
import { oidcDependencies, providerContext } from "../../support/oidc-provider.js";

function client(metadata: { clientAuthMethod: string; redirectUris?: string[] }): Client {
	return metadata as Client;
}

describe("clientBasedCors", () => {
	const spa = client({ clientAuthMethod: "none", redirectUris: ["https://spa.aegis.test/callback", "com.example.app:/callback"] });
	const web = client({ clientAuthMethod: "client_secret_basic", redirectUris: ["https://web.aegis.test/callback"] });
	const at = (route: string) => providerContext({ oidc: { route } });

	test("admits public clients from the origins of their redirect URIs", () => {
		expect(clientBasedCors(at("token"), "https://spa.aegis.test", spa)).toBe(true);
		expect(clientBasedCors(at("token"), "https://other.aegis.test", spa)).toBe(false);
		expect(clientBasedCors(at("token"), "null", spa)).toBe(false);
		expect(clientBasedCors(at("token"), "https://spa.aegis.test", client({ clientAuthMethod: "none" }))).toBe(false);
	});

	test("admits confidential clients to the UserInfo endpoint only", () => {
		expect(clientBasedCors(at("token"), "https://web.aegis.test", web)).toBe(false);
		expect(clientBasedCors(at("userinfo"), "https://web.aegis.test", web)).toBe(true);
	});
});

describe("renderError", () => {
	test("sends the browser to the error page of the web UI", () => {
		const described = providerContext();
		renderError(described, { error: "invalid_request", error_description: "missing parameter" });
		expect(described.redirect).toHaveBeenCalledWith("/error?error=invalid_request&error_description=missing+parameter");

		const bare = providerContext();
		renderError(bare, { error: "server_error" });
		expect(bare.redirect).toHaveBeenCalledWith("/error?error=server_error");
	});
});

describe("loadExistingGrant", () => {
	async function prepare(aegis: TestAegis, options: { skipConsent?: boolean } = {}) {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { allowedScopes: ["openid", "email"], ...options });
		const user = await aegis.createUser();
		const provider = aegis.services.oidc.requireProvider();
		const requestFor = (accountId: string | undefined, grantId?: string, clientId = application.id) =>
			providerContext({
				oidc: {
					provider,
					client: { clientId },
					session: { accountId, grantIdFor: () => grantId },
					requestParamScopes: new Set(["openid", "email", "profile", "unknown"]),
				},
			});
		return { application, user, provider, requestFor };
	}

	test("creates nothing without an application, a session or an account", async ({ aegis }) => {
		const { user, provider } = await prepare(aegis);
		const deps = oidcDependencies(aegis);

		for (const oidc of [{ provider }, { provider, client: { clientId: "1" } }, { provider, client: { clientId: "1" }, session: {} }]) {
			expect(await loadExistingGrant(providerContext({ oidc }), deps)).toBeUndefined();
		}
		expect(user).toBeDefined();
	});

	test("restores the scopes the account approved, within what the application may ask for", async ({ aegis }) => {
		const { application, user, requestFor } = await prepare(aegis);
		const deps = oidcDependencies(aegis);

		expect(await loadExistingGrant(requestFor(user.id), deps)).toBeUndefined();

		await aegis.services.consents.merge(user.id, application.id, ["openid", "profile"], new Date());
		const grant = await loadExistingGrant(requestFor(user.id), deps);

		expect(grant?.accountId).toBe(user.id);
		expect(grant?.getOIDCScope()).toBe("openid");
	});

	test("reuses the grant of the session, but never one of another account or application", async ({ aegis }) => {
		const { application, user, provider, requestFor } = await prepare(aegis);
		const deps = oidcDependencies(aegis);
		const other = await aegis.createUser();
		const own = new provider.Grant({ accountId: user.id, clientId: application.id });
		own.addOIDCScope("openid email");
		const foreignAccount = new provider.Grant({ accountId: other.id, clientId: application.id });
		foreignAccount.addOIDCScope("openid email");
		const foreignClient = new provider.Grant({ accountId: user.id, clientId: "1" });
		foreignClient.addOIDCScope("openid email");

		expect((await loadExistingGrant(requestFor(user.id, await own.save()), deps))?.jti).toBe(own.jti);
		expect(await loadExistingGrant(requestFor(user.id, await foreignAccount.save()), deps)).toBeUndefined();
		expect(await loadExistingGrant(requestFor(user.id, await foreignClient.save()), deps)).toBeUndefined();
		expect(await loadExistingGrant(requestFor(user.id, "missing"), deps)).toBeUndefined();
	});

	test("restores nothing for accounts that may not sign in to the application", async ({ aegis }) => {
		const { application, user, requestFor } = await prepare(aegis);
		const deps = oidcDependencies(aegis);
		await aegis.services.consents.merge(user.id, application.id, ["openid", "email"], new Date());

		await aegis.services.clients.update(application.id, { accessPolicy: "assigned" }, new Date());
		expect(await loadExistingGrant(requestFor(user.id), deps)).toBeUndefined();

		await aegis.services.clients.update(application.id, { accessPolicy: "everyone" }, new Date());
		await aegis.services.users.update(user.id, { enabled: false }, new Date());
		expect(await loadExistingGrant(requestFor(user.id), deps)).toBeUndefined();
		expect(await loadExistingGrant(requestFor("1"), deps)).toBeUndefined();
		expect(await loadExistingGrant(requestFor(user.id, undefined, "unknown"), deps)).toBeUndefined();
	});

	test("grants trusted web applications what they ask for and remembers it", async ({ aegis }) => {
		const { application, user, requestFor } = await prepare(aegis, { skipConsent: true });

		const grant = await loadExistingGrant(requestFor(user.id), oidcDependencies(aegis));

		expect(grant?.getOIDCScope()).toBe("openid email");
		expect(await aegis.services.consents.find(user.id, application.id)).toEqual(["openid", "email"]);
	});
});

describe("mayUseClient", () => {
	test("refuses and records a request without an application or an account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const user = await aegis.createUser();
		const deps = oidcDependencies(aegis);

		expect(await mayUseClient(providerContext({ oidc: { client: { clientId: application.id } } }), user.id, deps)).toBe(true);
		expect(await mayUseClient(providerContext({ oidc: {} }), user.id, deps)).toBe(false);
		expect(await mayUseClient(providerContext({ oidc: { client: { clientId: application.id } } }), "1", deps)).toBe(false);

		await vi.waitFor(async () => {
			const denied = await auditEvents(aegis, "oidc.authorization.denied");
			expect(denied.map((event) => [event.actor?.id ?? null, event.client?.id ?? null])).toEqual(
				expect.arrayContaining([
					[user.id, null],
					[null, application.id],
				]),
			);
		});
	});
});
