import type { FastifyInstance } from "fastify";
import { notFound } from "../../lib/errors.js";
import { access, authorize, requireAccessDeclaration } from "../access.js";
import { apiResponseHeaders, createOriginGuard } from "../security.js";
import { accountRoutes } from "./account.js";
import { applicationsRoutes } from "./applications/index.js";
import { auditRoutes } from "./audit.js";
import { authRoutes } from "./auth/index.js";
import { mediaRoutes } from "./media.js";
import { overviewRoutes } from "./overview.js";
import { sessionsRoutes } from "./sessions.js";
import { settingsRoutes } from "./settings/index.js";
import { systemRoutes } from "./system.js";
import { usersRoutes } from "./users/index.js";

/**
 * `/api`: the JSON API of the web UI. Paths name resources; every route declares who may call it
 * with `access(...)`, and that is checked before anything else runs. Each plugin registers its routes
 * relative to its own prefix, so every path segment is written once.
 *
 * - `/health`, `/instance`, `/setup` (`system.ts`)
 * - `/media` (`media.ts`)
 * - `/auth`, including the password reset and e-mail confirmation links (`auth/`)
 * - `/account`, `/overview` (`account.ts`, `overview.ts`)
 * - `/users`, `/applications` (`users/`, `applications/`)
 * - `/sessions`, `/audit` (`sessions.ts`, `audit.ts`)
 * - `/settings` (`settings/`)
 */
export async function apiRoutes(app: FastifyInstance): Promise<void> {
	app.decorateRequest("auth");
	app.addHook("onRoute", requireAccessDeclaration);
	app.addHook("onRequest", createOriginGuard(app.services.config));
	app.addHook("onRequest", authorize);
	app.addHook("onSend", apiResponseHeaders);

	await app.register(systemRoutes);
	await app.register(mediaRoutes, { prefix: "/media" });
	await app.register(authRoutes, { prefix: "/auth" });
	await app.register(accountRoutes, { prefix: "/account" });
	await app.register(overviewRoutes, { prefix: "/overview" });
	await app.register(usersRoutes, { prefix: "/users" });
	await app.register(applicationsRoutes, { prefix: "/applications" });
	await app.register(sessionsRoutes, { prefix: "/sessions" });
	await app.register(auditRoutes, { prefix: "/audit" });
	await app.register(settingsRoutes, { prefix: "/settings" });

	// Unknown API routes are answered here and never fall through to the web UI.
	app.all("/*", access("public"), async () => {
		throw notFound("Route");
	});
}
