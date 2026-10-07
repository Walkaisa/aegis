import { describe, expect, it } from "vitest";
import {
	applicationKindOf,
	buildSnippets,
	INTEGRATIONS,
	integrationsFor,
	isApplicationKind,
	joinUrl,
	type SnippetContext,
} from "@/lib/applications";

describe("applications", () => {
	it("derives the kind of an application from its type and redirects", () => {
		expect(applicationKindOf({ type: "confidential", redirectUris: [] })).toBe("web");
		expect(applicationKindOf({ type: "public", redirectUris: ["https://spa.example.com/cb"] })).toBe("spa");
		expect(applicationKindOf({ type: "public", redirectUris: ["https://spa.example.com/cb", "com.example.app:/cb"] })).toBe("native");
		expect(isApplicationKind("spa")).toBe(true);
		expect(isApplicationKind("desktop")).toBe(false);
		expect(isApplicationKind(1)).toBe(false);
	});

	it("offers the integrations of each kind", () => {
		expect(integrationsFor("web").map((integration) => integration.id)).toEqual(["authjs", "oauth2-proxy", "generic"]);
		expect(integrationsFor("native").map((integration) => integration.id)).toEqual(["appauth", "generic"]);
	});

	it("joins application URLs and paths", () => {
		expect(joinUrl("https://app.example.com/", "/callback")).toBe("https://app.example.com/callback");
		expect(joinUrl("https://app.example.com//", "/")).toBe("https://app.example.com");
		expect(joinUrl("  ", "/callback")).toBe("");
		expect(joinUrl("https://app.example.com", "")).toBe("");
	});

	const context: SnippetContext = {
		issuer: "https://auth.example.com",
		clientId: "123",
		clientSecret: "s3cret",
		redirectUri: "https://app.example.com/cb",
		postSignOutRedirectUri: "https://app.example.com/",
		scopes: ["openid", "profile", "email"],
	};

	it("writes a configuration for every integration", () => {
		for (const integration of INTEGRATIONS) {
			const code = buildSnippets(integration.id, context)
				.map((snippet) => snippet.code)
				.join("\n");
			expect(code, integration.id).toContain("https://auth.example.com");
			expect(code, integration.id).toContain("123");
		}
		expect(buildSnippets("authjs", context)[1]?.code).toContain('{ id: "aegis", name: "Aegis", type: "oidc" }');
		expect(buildSnippets("oidc-client-ts", context)[0]?.code).toContain('post_logout_redirect_uri: "https://app.example.com/"');
	});

	it("leaves out what a public client or a narrower scope does not need", () => {
		const publicClient = { ...context, clientSecret: null, postSignOutRedirectUri: null, scopes: ["openid"] };

		for (const id of ["authjs", "oauth2-proxy", "generic"] as const) {
			const code = buildSnippets(id, publicClient)
				.map((snippet) => snippet.code)
				.join("\n");
			expect(code, id).not.toMatch(/AEGIS_SECRET|CLIENT_SECRET|client_secret/);
		}
		expect(buildSnippets("authjs", publicClient)[1]?.code).toContain('authorization: { params: { scope: "openid" } }');
		expect(buildSnippets("oidc-client-ts", publicClient)[0]?.code).not.toContain("post_logout_redirect_uri");
	});
});
