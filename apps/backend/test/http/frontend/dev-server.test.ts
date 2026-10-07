import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingHttpHeaders, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import fastifyCookie from "@fastify/cookie";
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect } from "vitest";
import { errorHandler } from "../../../src/http/error-handler.js";
import { sendPage, serveDevServer } from "../../../src/http/frontend/dev-server.js";
import { test as base, type TestAegis } from "../../support/aegis.js";
import { TestClient } from "../../support/client.js";
import { inlineScript, scriptHash } from "../../support/frontend.js";

/** `app/[locale]` of a frontend: pages in route groups, a layout and a component that are not pages. */
const APP_FILES = [
	"layout.tsx",
	"page.tsx",
	"404/page.tsx",
	"setup/page.tsx",
	"(auth)/sign-in/page.tsx",
	"(auth)/sign-in/application/page.tsx",
	"(admin)/users/page.tsx",
	"(admin)/users/[id]/page.tsx",
	"(admin)/users/[id]/user-form.tsx",
];

interface UpstreamRequest {
	method: string;
	url: string;
	headers: IncomingHttpHeaders;
}

/** Stands in for `next dev`: pages are HTML with an inline script, everything else plain files. */
function startUpstream(): Promise<{ server: Server; url: string; requests: UpstreamRequest[] }> {
	const requests: UpstreamRequest[] = [];
	const server = createServer((request, response) => {
		const url = request.url ?? "/";
		requests.push({ method: request.method ?? "GET", url, headers: request.headers });
		if (url === "/_next/webpack-hmr") {
			// An answer without a content type, like an event stream that has not started yet.
			response.end();
			return;
		}
		if (url.startsWith("/_next/") || url === "/favicon.ico") {
			response.writeHead(200, { "content-type": "application/javascript" }).end("console.log('bundle')");
			return;
		}
		const [, locale = "", ...rest] = url.split("?")[0]?.split("/") ?? [];
		const page = rest.join("/");
		const html = `<!DOCTYPE html><html><head><script>${inlineScript(decodeURIComponent(page), locale)}</script></head><body>${url}</body></html>`;
		response.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": Buffer.byteLength(html) }).end(html);
	});
	return new Promise((resolve) => {
		server.listen(0, "127.0.0.1", () => {
			resolve({ server, url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, requests });
		});
	});
}

interface DevServer {
	aegis: TestAegis;
	app: FastifyInstance;
	browser: () => TestClient;
	requests: UpstreamRequest[];
}

const test = base.extend<{ dev: DevServer }>({
	dev: async ({ aegis }, use) => {
		const appDir = await mkdtemp(join(tmpdir(), "aegis-app-"));
		for (const file of APP_FILES) {
			await mkdir(join(appDir, file, ".."), { recursive: true });
			await writeFile(join(appDir, file), "export default function Page() {}");
		}
		const upstream = await startUpstream();
		const app = Fastify();
		app.decorate("services", aegis.services);
		app.setErrorHandler(errorHandler);
		await app.register(fastifyCookie);
		await serveDevServer(app, appDir, upstream.url);
		await app.ready();

		await use({ aegis, app, browser: () => new TestClient(app, aegis.config.issuer), requests: upstream.requests });

		await app.close();
		await new Promise((resolve) => upstream.server.close(resolve));
		await rm(appDir, { recursive: true, force: true });
	},
});

/** A browser with a session of an admin, after the setup. */
async function signedIn(dev: DevServer): Promise<TestClient> {
	await dev.aegis.setup();
	const admin = await dev.aegis.createUser({ role: "admin" });
	const { token } = await dev.aegis.services.auth.createSession(admin, { ip: null, userAgent: null });
	const browser = dev.browser();
	browser.setCookie(dev.aegis.services.sessionCookie.name, token);
	return browser;
}

describe("serveDevServer", () => {
	test("rewrites pages to the route the export would serve, with a policy for their scripts", async ({ dev }) => {
		const browser = await signedIn(dev);

		const page = await browser.get("/users/123?tab=sessions", { headers: { "accept-encoding": "gzip", "accept-language": "de" } });

		expect(page.statusCode).toBe(200);
		expect(page.body).toContain("/de/users/[id]?tab=sessions");
		expect(page.headers["content-security-policy"]).toContain(scriptHash(inlineScript("users/[id]", "de")));
		const forwarded = dev.requests.at(-1);
		expect(forwarded?.url).toBe("/de/users/[id]?tab=sessions");
		expect(forwarded?.headers["accept-encoding"]).toBeUndefined();
		expect((await browser.get("/")).body).toContain("<body>/en</body>");
	});

	test("answers unknown pages with the 404 page", async ({ dev }) => {
		const browser = await signedIn(dev);

		const missing = await browser.get("/nothing");

		expect(missing.statusCode).toBe(404);
		expect(dev.requests.at(-1)?.url).toBe("/en/404");
	});

	test("applies the gating of the pages", async ({ dev }) => {
		const anonymous = dev.browser();

		expect((await anonymous.get("/users")).headers.location).toBe("/setup");
		await dev.aegis.setup();
		expect((await anonymous.get("/users")).headers.location).toBe("/sign-in?next=%2Fusers");
		expect(dev.requests).toEqual([]);
	});

	test("passes bundles, hot reloading and files through unchanged", async ({ dev }) => {
		const browser = dev.browser();

		const bundle = await browser.get("/_next/static/chunks/app.js");
		expect(bundle.body).toBe("console.log('bundle')");
		expect(bundle.headers["content-security-policy"]).toBeUndefined();
		expect((await browser.request("POST", "/__nextjs_original-stack-frames", { body: {} })).statusCode).toBe(200);
		expect((await browser.get("/favicon.ico")).statusCode).toBe(200);
		expect((await browser.get("/_next/webpack-hmr")).statusCode).toBe(200);
		expect(dev.requests.map((request) => `${request.method} ${request.url}`)).toEqual([
			"GET /_next/static/chunks/app.js",
			"POST /__nextjs_original-stack-frames",
			"GET /favicon.ico",
			"GET /_next/webpack-hmr",
		]);
	});

	test("never forwards the backend's namespaces or writes to pages", async ({ dev }) => {
		const browser = await signedIn(dev);

		for (const [method, path] of [
			["GET", "/api/users"],
			["GET", "/.well-known/openid-configuration"],
			["POST", "/users"],
			["DELETE", "/"],
		] as const) {
			const response = await browser.request(method, path);
			expect(response.statusCode, `${method} ${path}`).toBe(404);
			expect(response.json().error.code).toBe("not_found");
		}
		expect(dev.requests).toEqual([]);
	});
});

describe("sendPage", () => {
	test("reports a page that broke off on its way from the development server", async ({ aegis }) => {
		const app = Fastify();
		app.decorate("services", aegis.services);
		app.setErrorHandler(errorHandler);
		app.get("/", (_request, reply) => {
			const page = new Readable({
				read() {
					this.push("<!DOCTYPE html><html>");
					this.destroy(new Error("socket hang up"));
				},
			});
			void sendPage(reply, page, aegis.config);
			return reply;
		});

		const response = await app.inject("/");

		expect(response.statusCode).toBe(500);
		expect(response.json().error.code).toBe("internal_error");
		await app.close();
	});
});
