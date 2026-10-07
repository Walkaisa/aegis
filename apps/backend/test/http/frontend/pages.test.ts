import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { isBackendPath, PageTable, resolvePage, safeReturnPath } from "../../../src/http/frontend/pages.js";
import type { AppServices } from "../../../src/services/container.js";

describe("isBackendPath", () => {
	it("knows the namespaces of the API and the protocol", () => {
		for (const path of ["/api", "/api/users", "/oauth2/authorize", "/.well-known/jwks.json"]) {
			expect(isBackendPath(path), path).toBe(true);
		}
		for (const path of ["/", "/apis", "/users/api", "/oauth2x"]) {
			expect(isBackendPath(path), path).toBe(false);
		}
	});
});

describe("safeReturnPath", () => {
	it("allows pages of the administration only", () => {
		expect(safeReturnPath("/users/1?tab=sessions#top")).toBe("/users/1?tab=sessions#top");
		for (const value of [
			null,
			undefined,
			"",
			"users",
			"//evil.example",
			"/\\evil.example",
			"/\t/evil.example",
			"/sign-in?next=/x",
			"/setup",
			"/api/users",
			"/consent",
		]) {
			expect(safeReturnPath(value), String(value)).toBe("/");
		}
	});
});

describe("PageTable", () => {
	const pages = new PageTable([
		"",
		"404",
		"sign-in/application",
		"users",
		"users/new",
		"users/[id]",
		"users/[id]/settings",
		"applications/[id]",
	]);

	it("matches static segments before parameters", () => {
		expect(pages.match("/")).toBe("");
		expect(pages.match("/users")).toBe("users");
		expect(pages.match("/users/new")).toBe("users/new");
		expect(pages.match("/users/123")).toBe("users/[id]");
		expect(pages.match("/users/123/settings")).toBe("users/[id]/settings");
		expect(pages.match("/applications/new")).toBe("applications/[id]");
		// Like Next.js: a static segment without the rest of the path falls back to the parameter.
		expect(pages.match("/users/new/settings")).toBe("users/[id]/settings");
	});

	it("knows no hidden, partial or empty-segment pages", () => {
		for (const path of ["/404", "/sign-in/application", "/sign-in", "/users/123/other", "/users//settings", "/applications"]) {
			expect(pages.match(path), path).toBeNull();
		}
	});
});

describe("resolvePage", () => {
	it("rebuilds canonical paths from their segments, so they never name another host", async () => {
		const url = new URL("http://aegis.internal");
		url.pathname = "//evil.example/";
		url.search = "?a=1";

		const answer = await resolvePage({} as AppServices, {} as FastifyRequest, new PageTable([]), url);

		expect(answer).toEqual({ type: "redirect", location: "/evil.example?a=1", statusCode: 308 });
	});
});
