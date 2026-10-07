import type { KoaContextWithOIDC } from "oidc-provider";
import { vi } from "vitest";
import type { OidcDependencies } from "../../src/oidc/provider.js";
import type { TestAegis } from "./aegis.js";

export interface ProviderContextOptions {
	oidc?: Record<string, unknown>;
	headers?: Record<string, string>;
	cookies?: Record<string, string>;
}

/** A request as oidc-provider hands it to its hooks and events, with only what they read. */
export function providerContext({ oidc, headers = {}, cookies = {} }: ProviderContextOptions = {}) {
	const ctx = {
		req: {},
		oidc,
		get: (name: string) => headers[name.toLowerCase()] ?? "",
		cookies: { get: (name: string) => cookies[name] },
		append: vi.fn(),
		redirect: vi.fn(),
	};
	return ctx as typeof ctx & KoaContextWithOIDC;
}

/** What `createProvider` needs, taken from the services of a test instance. */
export function oidcDependencies(aegis: TestAegis): OidcDependencies {
	const { services } = aegis;
	return {
		config: services.config,
		settings: services.settings,
		users: services.users,
		clients: services.clients,
		consents: services.consents,
		sessions: services.sessions,
		oidcArtifacts: services.oidcArtifacts,
		keyService: services.keyService,
		encryptor: services.encryptor,
		audit: services.audit,
		auth: services.auth,
		applicationAccess: services.applicationAccess,
		sessionCookie: services.sessionCookie,
		log: services.log,
	};
}
