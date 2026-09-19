import type { FastifyInstance } from "fastify";
import { authRequestRoutes } from "./requests.js";
import { authSessionRoutes } from "./session.js";

/**
 * `/api/auth`: signing in. Both routes start the same session, which serves the administration and
 * application sign-ins alike (see `http/access.ts`):
 *
 * - `/session`: the administration, for accounts with `console:access` (`session.ts`)
 * - `/requests/:challenge`: authorization requests of applications, within their access policy (`requests.ts`)
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
	await app.register(authSessionRoutes, { prefix: "/session" });
	await app.register(authRequestRoutes, { prefix: "/requests/:challenge" });
}
