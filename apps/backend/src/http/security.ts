import { createHash } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import { ApiError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** For every response that is not a page: API responses and static files. */
export const RESOURCE_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

/** `<script>` elements of a page; those with a `src` attribute load a file from Aegis itself. */
const SCRIPT_ELEMENT = /<script\b([^>]*)>([\s\S]*?)<\/script\b[^>]*>/gi;

/**
 * CSRF defence for the cookie-authenticated API. Browsers always attach `Origin` and
 * `Sec-Fetch-Site` to state-changing fetches; cross-site requests are rejected. Non-browser
 * clients send neither header and are unaffected. Session cookies are additionally SameSite=Lax
 * and only `application/json` bodies (and images on upload routes) are accepted.
 */
export function createOriginGuard(config: AppConfig) {
	return async function originGuard(request: FastifyRequest): Promise<void> {
		if (SAFE_METHODS.has(request.method)) {
			return;
		}

		const fetchSite = request.headers["sec-fetch-site"];
		if (typeof fetchSite === "string" && fetchSite !== "same-origin" && fetchSite !== "none") {
			throw new ApiError(403, "cross_origin_rejected", "Cross-origin request rejected");
		}

		const origin = request.headers.origin;
		if (typeof origin === "string" && origin !== config.issuerOrigin) {
			throw new ApiError(403, "cross_origin_rejected", "Cross-origin request rejected");
		}
	};
}

/** API responses are not cached and never render as a document. */
export async function apiResponseHeaders(_request: FastifyRequest, reply: FastifyReply, payload: unknown): Promise<unknown> {
	// Responses that are safe to cache (images with a content hash in the URL) say so themselves.
	if (!reply.hasHeader("cache-control")) {
		reply.header("cache-control", "no-store");
	}
	reply.header("content-security-policy", RESOURCE_CONTENT_SECURITY_POLICY);
	return payload;
}

/** CSP hash sources of the inline scripts in a page, such as the theme script and the Next.js bootstrap. */
function inlineScriptHashes(html: string): string[] {
	const hashes = new Set<string>();
	for (const [, attributes = "", content = ""] of html.matchAll(SCRIPT_ELEMENT)) {
		if (/\bsrc\s*=/i.test(attributes)) {
			continue;
		}
		// Browsers hash the script text after the HTML parser has normalized its line breaks.
		const text = content.replace(/\r\n?/g, "\n");
		hashes.add(`'sha256-${createHash("sha256").update(text).digest("base64")}'`);
	}
	return [...hashes];
}

/**
 * Strict CSP for a page of the frontend: scripts only from Aegis itself, inline scripts only if
 * they belong to exactly this page, pinned by their SHA-256 hash. Pages are static files, so the
 * hashes take the place of a per-request nonce.
 */
export function pageContentSecurityPolicy(html: string, config: AppConfig): string {
	const scriptSources = ["'self'", ...inlineScriptHashes(html)];
	if (!config.isProduction) {
		scriptSources.push("'unsafe-eval'");
	}

	return [
		"default-src 'self'",
		`script-src ${scriptSources.join(" ")}`,
		"style-src 'self' 'unsafe-inline'",
		"img-src 'self' data: blob:",
		"font-src 'self' data:",
		config.isProduction ? "connect-src 'self'" : "connect-src 'self' ws: wss:",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
	].join("; ");
}
