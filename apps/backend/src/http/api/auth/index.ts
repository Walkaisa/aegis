import type { FastifyInstance } from "fastify";
import { recoveryRoutes } from "./recovery.js";
import { authRequestRoutes } from "./requests.js";
import { authSessionRoutes } from "./session.js";

/**
 * `/api/auth`: signing in. Both routes start the same session, which serves the administration and
 * application sign-ins alike (see `http/access.ts`):
 *
 * - `/session`: the administration, for accounts with `console:access` (`session.ts`)
 * - `/requests/:challenge`: authorization requests of applications, within their access policy (`requests.ts`)
 *
 * Next to them live the flows that are finished from a link in a mailbox — resetting a password
 * and confirming a new e-mail address (`recovery.ts`).
 */
export async function authRoutes(app: FastifyInstance): Promise<void> {
	await app.register(authSessionRoutes, { prefix: "/session" });
	await app.register(authRequestRoutes, { prefix: "/requests/:challenge" });
	await app.register(recoveryRoutes);
}
