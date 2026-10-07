import { describe, expect, it } from "vitest";
import {
	allowedScopesSchema,
	classifyRedirectUri,
	clientCreateSchema,
	clientUpdateSchemaFor,
	MAX_REDIRECT_URIS,
	PKCE_POLICIES_BY_TYPE,
	redirectUriSchema,
} from "../src/clients";

const base = {
	name: " Wiki ",
	description: "",
	tokenEndpointAuthMethod: "client_secret_basic",
	redirectUris: ["https://wiki.example.com/cb"],
	postLogoutRedirectUris: [],
	allowedScopes: ["openid"],
	skipConsent: false,
} as const;

describe("classifyRedirectUri", () => {
	it.each([
		["https://app.example.com/callback", "https"],
		["https://app.example.com:8443/cb?x=1", "https"],
		["http://localhost:3000/cb", "loopback"],
		["http://127.0.0.1/cb", "loopback"],
		["http://[::1]:8080/cb", "loopback"],
		["com.example.app:/oauth", "custom_scheme"],
		["com.example.app://callback", "custom_scheme"],
	] as const)("accepts %s as %s", (uri, kind) => {
		expect(classifyRedirectUri(uri)).toEqual({ ok: true, kind });
	});

	it.each([
		["https://*.example.com/cb", "redirect_uri_wildcard"],
		["https://app.example.com/cb#fragment", "redirect_uri_fragment"],
		["https://app.example.com/c b", "redirect_uri_invalid"],
		["not a url", "redirect_uri_invalid"],
		["relative/path", "redirect_uri_invalid"],
		["https://user:pass@app.example.com/cb", "redirect_uri_credentials"],
		["https://user@app.example.com/cb", "redirect_uri_credentials"],
		["http://app.example.com/cb", "redirect_uri_insecure"],
		["http://localhost.evil.com/cb", "redirect_uri_insecure"],
		["myapp:/callback", "redirect_uri_invalid"],
		["javascript:alert(1)", "redirect_uri_invalid"],
		["data:text/html,hi", "redirect_uri_invalid"],
		["file:///etc/passwd", "redirect_uri_invalid"],
	])("rejects %s with %s", (uri, code) => {
		expect(classifyRedirectUri(uri)).toEqual({ ok: false, code });
	});
});

describe("redirectUriSchema", () => {
	it("trims and reports the classification as issue", () => {
		expect(redirectUriSchema.parse("  https://app.example.com/cb  ")).toBe("https://app.example.com/cb");
		expect(redirectUriSchema.safeParse("http://evil.com").error?.issues[0]?.message).toBe("redirect_uri_insecure");
		expect(redirectUriSchema.safeParse("").error?.issues[0]?.message).toBe("required");
		expect(redirectUriSchema.safeParse(`https://a.io/${"x".repeat(2000)}`).error?.issues[0]?.message).toBe("too_long");
	});
});

describe("allowedScopesSchema", () => {
	it("requires openid, removes duplicates and sorts canonically", () => {
		expect(allowedScopesSchema.parse(["email", "openid", "email", "profile"])).toEqual(["openid", "profile", "email"]);
		expect(allowedScopesSchema.safeParse(["profile"]).error?.issues[0]?.message).toBe("scope_openid_required");
		expect(allowedScopesSchema.safeParse(["openid", "admin"]).error?.issues[0]?.message).toBe("invalid");
	});
});

describe("clientCreateSchema", () => {
	it("defaults the access and PKCE policy per client type", () => {
		expect(clientCreateSchema.parse({ ...base, type: "confidential" })).toMatchObject({
			name: "Wiki",
			accessPolicy: "everyone",
			pkcePolicy: PKCE_POLICIES_BY_TYPE.confidential[0],
		});
		expect(clientCreateSchema.parse({ ...base, type: "public" }).pkcePolicy).toBe("required");
	});

	it("keeps an allowed PKCE policy and rejects a weaker one for public clients", () => {
		expect(clientCreateSchema.parse({ ...base, type: "confidential", pkcePolicy: "disabled" }).pkcePolicy).toBe("disabled");
		const result = clientCreateSchema.safeParse({ ...base, type: "public", pkcePolicy: "optional" });
		expect(result.error?.issues).toEqual([
			expect.objectContaining({ message: "pkce_required_for_public_clients", path: ["pkcePolicy"] }),
		]);
	});

	it("rejects duplicate redirect URIs in both lists", () => {
		const result = clientCreateSchema.safeParse({
			...base,
			type: "confidential",
			redirectUris: ["https://a.io/cb", "https://a.io/cb"],
			postLogoutRedirectUris: ["https://a.io/", "https://a.io/"],
		});
		expect(result.error?.issues.map((issue) => [issue.message, issue.path.join(".")])).toEqual([
			["redirect_uri_duplicate", "redirectUris.1"],
			["redirect_uri_duplicate", "postLogoutRedirectUris.1"],
		]);
	});

	it("allows custom schemes only for public clients", () => {
		const native = { ...base, redirectUris: ["com.example.app:/cb"] };
		expect(clientCreateSchema.safeParse({ ...native, type: "public" }).success).toBe(true);
		expect(clientCreateSchema.safeParse({ ...native, type: "confidential" }).error?.issues[0]).toMatchObject({
			message: "redirect_uri_custom_scheme",
			path: ["redirectUris", 0],
		});
	});

	it("enforces the list limits", () => {
		expect(clientCreateSchema.safeParse({ ...base, type: "confidential", redirectUris: [] }).error?.issues[0]?.message).toBe(
			"redirect_uris_required",
		);
		const many = Array.from({ length: MAX_REDIRECT_URIS + 1 }, (_value, index) => `https://a.io/${index}`);
		expect(clientCreateSchema.safeParse({ ...base, type: "confidential", redirectUris: many }).error?.issues[0]?.message).toBe(
			"too_many_items",
		);
	});
});

describe("clientUpdateSchemaFor", () => {
	const update = { ...base, accessPolicy: "assigned", pkcePolicy: "required", enabled: true } as const;

	it("validates against the immutable client type", () => {
		expect(clientUpdateSchemaFor("confidential").parse(update)).toMatchObject({ accessPolicy: "assigned", enabled: true });
		expect(clientUpdateSchemaFor("public").safeParse({ ...update, pkcePolicy: "disabled" }).success).toBe(false);
		expect(clientUpdateSchemaFor("confidential").safeParse({ ...update, redirectUris: ["com.example.app:/cb"] }).success).toBe(false);
	});
});
