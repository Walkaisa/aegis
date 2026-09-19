import { randomBytes } from "node:crypto";
import { hasPermission } from "@aegis/contracts";
import fastifyHttpProxy from "@fastify/http-proxy";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { AppServices } from "../services/container.js";
import { getSession } from "./access.js";
import { buildPageContentSecurityPolicy } from "./security.js";

declare module "fastify" {
	interface FastifyRequest {
		cspNonce: string;
	}
}

/** Next.js internals and the static brand assets in `apps/web/public`; never gated or redirected. */
const PASSTHROUGH_PATTERN =
	/^\/(?:_next\/|__nextjs|brand\/|icons\/|favicon\.ico$|apple-touch-icon\.png$|manifest\.webmanifest$|robots\.txt$)/;

/** Pages outside the administration: sign-in (administration and applications), consent and results. */
const PUBLIC_PAGES = new Set(["/sign-in", "/consent", "/error", "/signed-out"]);

/** Post sign-in destinations: pages of the administration UI only, never external URLs. */
export function safeReturnPath(value: string | null | undefined): string {
	if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
		return "/";
	}
	const path = value.split(/[?#]/, 1)[0] ?? "/";
	if (PUBLIC_PAGES.has(path) || path === "/setup" || /^\/(?:api|oauth2|\.well-known)(?:\/|$)/.test(path)) {
		return "/";
	}
	return value;
}

/**
 * Server-side page gating before a page is proxied to Next.js: without settings every page leads
 * to the setup; once set up, the setup is closed for good and every page except the public ones
 * belongs to the administration and requires a session with `console:access`.
 */
async function resolvePageRedirect(services: AppServices, request: FastifyRequest): Promise<string | null> {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return null;
	}

	const mayUseConsole = async () => {
		const session = await getSession(services, request);
		return session !== null && hasPermission(session.user.role, "console:access");
	};

	const url = new URL(request.url, "http://aegis.internal");
	const path = url.pathname;
	if (PASSTHROUGH_PATTERN.test(path)) {
		return null;
	}

	if (!services.settings.isSetupComplete()) {
		return path === "/setup" ? null : "/setup";
	}
	if (path === "/setup") {
		return "/sign-in";
	}

	if (PUBLIC_PAGES.has(path)) {
		// A sign-in for an application (`?challenge=`) is completed on the page itself.
		if (path === "/sign-in" && !url.searchParams.has("challenge") && (await mayUseConsole())) {
			return safeReturnPath(url.searchParams.get("next"));
		}
		return null;
	}

	if (await mayUseConsole()) {
		return null;
	}
	const target = `${path}${url.search}`;
	return target === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(target)}`;
}

/**
 * Everything that is neither API nor protocol: pages and assets of the web UI, proxied to the
 * internal Next.js server so the browser only ever talks to a single origin. Each page response
 * gets a fresh CSP nonce, which Next.js picks up from the forwarded `Content-Security-Policy`
 * request header.
 */
export async function webRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;
	const { config } = services;
	app.decorateRequest("cspNonce", "");

	await app.register(fastifyHttpProxy, {
		// Pages, static assets and proxy details stay out of the request log.
		logLevel: "warn",
		upstream: config.webUpstream,
		prefix: "/",
		websocket: !config.isProduction,
		httpMethods: config.isProduction ? ["GET", "HEAD"] : ["DELETE", "GET", "HEAD", "PATCH", "POST", "PUT", "OPTIONS"],
		preHandler: async (request, reply) => {
			request.cspNonce = randomBytes(18).toString("base64");
			const redirect = await resolvePageRedirect(services, request);
			if (redirect) {
				return reply.redirect(redirect, 303);
			}
		},
		replyOptions: {
			rewriteRequestHeaders: (request, headers) => {
				const nonce = request.cspNonce;
				return {
					...headers,
					"x-aegis-nonce": nonce,
					"content-security-policy": buildPageContentSecurityPolicy(nonce, config),
				};
			},
			rewriteHeaders: (headers, request) => {
				const { "x-powered-by": _poweredBy, ...rest } = headers;
				return {
					...rest,
					"content-security-policy": buildPageContentSecurityPolicy((request as FastifyRequest).cspNonce, config),
				};
			},
		},
	});
}
