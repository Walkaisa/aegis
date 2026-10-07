import { createHash, randomBytes } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { type AppConfig, loadConfig } from "../../src/config.js";
import {
	apiResponseHeaders,
	createOriginGuard,
	pageContentSecurityPolicy,
	RESOURCE_CONTENT_SECURITY_POLICY,
} from "../../src/http/security.js";

const configFor = (env: "development" | "production"): AppConfig =>
	loadConfig({
		NODE_ENV: env,
		AEGIS_ISSUER: "https://auth.example.com",
		AEGIS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
		AEGIS_DATABASE_URL: "postgres://localhost/aegis",
	});

const hash = (text: string) => `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
const request = (method: string, headers: Record<string, string> = {}) => ({ method, headers }) as unknown as FastifyRequest;

describe("createOriginGuard", () => {
	const guard = createOriginGuard(configFor("production"));

	it("lets safe methods and same-origin requests through", async () => {
		await expect(guard(request("GET", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }))).resolves.toBeUndefined();
		await expect(guard(request("HEAD"))).resolves.toBeUndefined();
		await expect(
			guard(request("POST", { origin: "https://auth.example.com", "sec-fetch-site": "same-origin" })),
		).resolves.toBeUndefined();
		await expect(guard(request("PUT", { "sec-fetch-site": "none" }))).resolves.toBeUndefined();
		await expect(guard(request("DELETE"))).resolves.toBeUndefined();
	});

	it("rejects cross-site and cross-origin state changes", async () => {
		const rejected: Record<string, string>[] = [
			{ "sec-fetch-site": "cross-site" },
			{ "sec-fetch-site": "same-site" },
			{ origin: "https://evil.example" },
			{ origin: "null" },
		];
		for (const headers of rejected) {
			await expect(guard(request("POST", headers))).rejects.toMatchObject({ statusCode: 403, code: "cross_origin_rejected" });
		}
	});
});

describe("apiResponseHeaders", () => {
	function reply(existing: Record<string, string> = {}) {
		const headers: Record<string, string> = { ...existing };
		return {
			headers,
			reply: {
				hasHeader: (name: string) => name in headers,
				header: (name: string, value: string) => {
					headers[name] = value;
				},
			} as unknown as FastifyReply,
		};
	}

	it("forbids caching unless the route allows it and never renders as a document", async () => {
		const plain = reply();
		await expect(apiResponseHeaders(request("GET"), plain.reply, "body")).resolves.toBe("body");
		expect(plain.headers).toEqual({ "cache-control": "no-store", "content-security-policy": RESOURCE_CONTENT_SECURITY_POLICY });

		const cached = reply({ "cache-control": "public, max-age=31536000, immutable" });
		await apiResponseHeaders(request("GET"), cached.reply, null);
		expect(cached.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
	});
});

describe("pageContentSecurityPolicy", () => {
	const page = [
		'<script src="/_next/static/chunks/app.js" async=""></script>',
		"<script>self.__next_f.push([0])</script>",
		'<script id="theme">(function(){document.documentElement.classList.add("dark")})()</script>',
		"<script>self.__next_f.push([0])</script>",
		"<SCRIPT>one\r\ntwo\rthree</SCRIPT>",
		"<script></script>",
	].join("");

	it("allows exactly the inline scripts of the page, by hash", () => {
		const policy = pageContentSecurityPolicy(page, configFor("production"));
		const scriptSources = policy.split("; ").find((directive) => directive.startsWith("script-src"));

		expect(scriptSources).toBe(
			[
				"script-src 'self'",
				hash("self.__next_f.push([0])"),
				hash('(function(){document.documentElement.classList.add("dark")})()'),
				hash("one\ntwo\nthree"),
				hash(""),
			].join(" "),
		);
		expect(policy).not.toContain("unsafe-inline' 'sha");
		expect(policy).toContain("connect-src 'self';");
		expect(policy).toContain("frame-ancestors 'none'");
		expect(policy).toContain("object-src 'none'");
	});

	it("adds what the development server needs", () => {
		const policy = pageContentSecurityPolicy("", configFor("development"));

		expect(policy).toContain("script-src 'self' 'unsafe-eval';");
		expect(policy).toContain("connect-src 'self' ws: wss:");
	});
});
