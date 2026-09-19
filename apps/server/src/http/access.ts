import { hasPermission, type Permission } from "@aegis/contracts";
import type { FastifyRequest, RouteOptions } from "fastify";
import { forbidden, unauthorized } from "../lib/errors.js";
import type { AuthenticatedSession } from "../services/auth.js";
import type { AppServices } from "../services/container.js";
import type { RateLimit } from "./rate-limits.js";

/*
 * A browser holds at most one session, used for the administration and application sign-ins alike.
 * What it may be used for is decided on every request by the role of its account
 * (`ROLE_PERMISSIONS` in `@aegis/contracts`):
 *
 * - API routes declare who may call them with `access(...)`, enforced by `authorize`,
 * - pages of the administration require `console:access` (`http/web.ts`),
 * - application sign-ins require access to the application (`ApplicationAccess`).
 */

/** Who may call an API route: anyone, any signed-in account, or accounts whose role grants a permission. */
export type Access = "public" | "authenticated" | Permission;

declare module "fastify" {
	interface FastifyContextConfig {
		access?: Access;
	}

	interface FastifyRequest {
		/** The signed-in account and its session. Set for every API route that is not `public`. */
		auth: AuthenticatedSession;
	}
}

const sessions = new WeakMap<FastifyRequest, Promise<AuthenticatedSession | null>>();

/** The session of the request, if any; resolved at most once per request. */
export function getSession(services: AppServices, request: FastifyRequest): Promise<AuthenticatedSession | null> {
	let pending = sessions.get(request);
	if (!pending) {
		pending = services.auth.resolveSession(services.sessionCookie.read(request));
		sessions.set(request, pending);
	}
	return pending;
}

/** Route options declaring who may call the route and, optionally, how often per client IP. */
export function access(access: Access, rateLimit?: RateLimit): { config: { access: Access; rateLimit?: RateLimit } } {
	return { config: rateLimit ? { access, rateLimit } : { access } };
}

/** Deny by default: an API route that does not declare who may call it fails at startup. */
export function requireAccessDeclaration(route: RouteOptions): void {
	if (!route.config?.access) {
		throw new Error(`${route.method} ${route.url} does not declare who may call it`);
	}
}

/** Checks the declared access of the route before its body is read. */
export async function authorize(request: FastifyRequest): Promise<void> {
	const required = request.routeOptions.config.access;
	if (required === "public") {
		return;
	}

	const auth = await getSession(request.server.services, request);
	if (!auth) {
		throw unauthorized();
	}
	if (required !== "authenticated" && (required === undefined || !hasPermission(auth.user.role, required))) {
		throw forbidden();
	}
	request.auth = auth;
}
