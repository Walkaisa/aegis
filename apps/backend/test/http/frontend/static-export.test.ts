import Fastify from "fastify";
import { test as base, describe, expect } from "vitest";
import { serveStaticExport } from "../../../src/http/frontend/static-export.js";
import type { AppServices } from "../../../src/services/container.js";
import { ADMIN, startAegis, type TestAegis } from "../../support/aegis.js";
import { createStaticExport, inlineScript, scriptHash } from "../../support/frontend.js";

/** Aegis in production mode, serving a fixture of the static export. */
const test = base.extend<{ aegis: TestAegis }>({
	// biome-ignore lint/correctness/noEmptyPattern: Vitest reads the fixtures a fixture depends on from this pattern.
	aegis: async ({}, use) => {
		const frontend = await createStaticExport({
			extra: { "de/only-german.html": "<!DOCTYPE html><html><body>nur Deutsch</body></html>", "de/notes.json": "{}" },
		});
		const aegis = await startAegis({ config: { isProduction: true, frontendDir: frontend.root } });
		await use(aegis);
		await aegis.close();
		await frontend.remove();
	},
});

describe("pages", () => {
	test("lead to the setup until it is complete, and never there again", async ({ aegis }) => {
		const browser = aegis.client();

		const setup = await browser.get("/setup");
		expect(setup.statusCode).toBe(200);
		expect(setup.body).toContain("en:setup");
		expect((await browser.get("/users")).headers.location).toBe("/setup");

		await aegis.setup();
		expect((await browser.get("/setup")).headers.location).toBe("/sign-in");
	});

	test("send visitors without a session to the sign-in and back", async ({ aegis }) => {
		await aegis.setup();
		const browser = aegis.client();

		const home = await browser.get("/");
		expect(home.statusCode).toBe(303);
		expect(home.headers.location).toBe("/sign-in");
		expect((await browser.get("/users/123?tab=sessions")).headers.location).toBe(
			`/sign-in?next=${encodeURIComponent("/users/123?tab=sessions")}`,
		);

		const signIn = await browser.get("/sign-in");
		expect(signIn.statusCode).toBe(200);
		expect(signIn.body).toContain("en:sign-in");
	});

	test("serve the page in the visitor's language with a policy for its inline script", async ({ aegis }) => {
		const admin = await aegis.setup();

		const english = await admin.get("/users/123");
		expect(english.statusCode).toBe(200);
		expect(english.headers["content-type"]).toBe("text/html; charset=utf-8");
		expect(english.headers["cache-control"]).toBe("no-store");
		expect(english.headers["content-security-policy"]).toContain(scriptHash(inlineScript("users/[id]", "en")));
		expect(english.body).toContain("en:users/[id]");

		expect((await admin.get("/users/new", { headers: { "accept-language": "de-DE,de;q=0.9" } })).body).toContain("de:users/new");
		admin.setCookie("aegis_locale", "de");
		expect((await admin.get("/")).body).toContain("de:</body>");
	});

	test("show the sign-in of an application for a challenge, even to admins", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.get("/sign-in?challenge=abc")).body).toContain("en:sign-in/application");
		expect((await admin.get("/sign-in/application")).statusCode).toBe(404);
	});

	test("send signed-in admins from the sign-in to where they wanted to go, within Aegis", async ({ aegis }) => {
		const admin = await aegis.setup();
		const next = async (value: string) => (await admin.get(`/sign-in?next=${encodeURIComponent(value)}`)).headers.location;

		expect(await next("/users?page=2")).toBe("/users?page=2");
		for (const unsafe of ["//evil.example", "https://evil.example", "/\\evil.example", "/sign-in", "/setup", "/api/users", "users"]) {
			expect(await next(unsafe), unsafe).toBe("/");
		}
	});

	test("canonicalize trailing slashes without ever leaving the host", async ({ aegis }) => {
		const admin = await aegis.setup();

		const slash = await admin.get("/users/?page=2");
		expect(slash.statusCode).toBe(308);
		expect(slash.headers.location).toBe("/users?page=2");
		expect((await admin.get("/users//123/")).headers.location).toBe("/users/123");
	});

	test("answer unknown URLs with the localized 404 page", async ({ aegis }) => {
		const admin = await aegis.setup();

		for (const path of ["/nothing", "/users/1/2", "/404", "/404.html", "/_not-found", "/de/notes.json"]) {
			const response = await admin.get(path);
			expect(response.statusCode, path).toBe(404);
			expect(response.body, path).toContain("en:404");
		}
	});

	test("are not served when a language lacks them", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.get("/only-german", { headers: { "accept-language": "de" } })).body).toContain("nur Deutsch");
		const english = await admin.get("/only-german");
		expect(english.statusCode).toBe(404);
		expect(english.json().error.code).toBe("not_found");
	});

	test("leave the namespaces of the backend alone", async ({ aegis }) => {
		await aegis.setup();

		for (const path of ["/api/nothing", "/oauth2/nothing", "/.well-known/nothing"]) {
			const response = await aegis.client().get(path);
			expect(response.statusCode, path).toBe(404);
			expect(response.body, path).not.toContain("en:404");
		}
	});
});

describe("payloads", () => {
	test("are served for pages the visitor may open", async ({ aegis }) => {
		const admin = await aegis.setup();

		const page = await admin.get("/users/123.txt");
		expect(page.statusCode).toBe(200);
		expect(page.body).toBe("payload en:users/[id]");
		expect(page.headers["cache-control"]).toBe("no-store");
		expect(page.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
		expect((await admin.get("/index.txt")).body).toBe("payload en:");
		expect((await admin.get("/users/123/__next._tree.txt")).body).toBe("tree en:users/[id]");
		expect((await admin.get("/users/123.txt?_rsc=1", { headers: { "accept-language": "de" } })).body).toBe("payload de:users/[id]");
	});

	test("are withheld from pages the visitor may not open or that do not exist", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await aegis.client().get("/users/123.txt")).statusCode).toBe(404);
		expect((await admin.get("/nothing.txt")).statusCode).toBe(404);
		expect((await admin.get("/__next._tree.txt")).statusCode).toBe(404);
		expect((await admin.get("/users/__next._head.txt")).statusCode).toBe(404);
	});
});

describe("static files", () => {
	test("are served with their caching and embedding rules", async ({ aegis }) => {
		const browser = aegis.client();

		const bundle = await browser.get("/_next/static/chunks/app.js");
		expect(bundle.statusCode).toBe(200);
		expect(bundle.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
		expect(bundle.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");

		const logo = await browser.get("/brand/logo.svg");
		expect(logo.headers["cross-origin-resource-policy"]).toBe("cross-origin");
		const icon = await browser.get("/favicon.ico");
		expect(icon.headers["cross-origin-resource-policy"]).toBe("same-origin");
		expect(icon.headers["cache-control"]).toBe("public, max-age=0");
	});

	test("never include files outside the export", async ({ aegis }) => {
		const browser = aegis.client();

		expect((await browser.get("/../package.json")).statusCode).toBe(303);
		expect((await browser.get("/%2e%2e/package.json")).statusCode).toBe(303);
		expect((await browser.get("/_next/static/missing.js")).statusCode).toBe(303);
	});
});

describe("loading the export", () => {
	async function load(options: Parameters<typeof createStaticExport>[0], dir?: (root: string) => string) {
		const frontend = await createStaticExport(options);
		const app = Fastify();
		app.decorate("services", { config: { issuer: ADMIN.email, isProduction: true } } as unknown as AppServices);
		try {
			await serveStaticExport(app, dir ? dir(frontend.root) : `${frontend.root}/out`);
		} finally {
			await app.close();
			await frontend.remove();
		}
	}

	base("fails without a build", async () => {
		await expect(load({}, (root) => `${root}/missing`)).rejects.toThrow("The frontend has not been built");
	});

	base("fails for a build without the 404 page of a language", async () => {
		await expect(load({ omit: ["en/404.html"] })).rejects.toThrow("en/404.html is missing");
	});
});
