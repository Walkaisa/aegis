import type { FastifyReply, FastifyRequest } from "fastify";
import type { AppConfig } from "../config.js";
import { ApiError } from "../lib/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const API_CONTENT_SECURITY_POLICY = "default-src 'none'; frame-ancestors 'none'";

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
	reply.header("content-security-policy", API_CONTENT_SECURITY_POLICY);
	return payload;
}

/** Strict nonce-based CSP for pages rendered by Next.js. */
export function buildPageContentSecurityPolicy(nonce: string, config: AppConfig): string {
	const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
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
