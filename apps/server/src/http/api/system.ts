import { type InstanceInfo, setupRequestSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/validation.js";
import { access } from "../access.js";
import { rateLimits } from "../rate-limits.js";
import { requestMeta } from "../request-context.js";
import { toAuthSessionResponse } from "./dto.js";

/** `/api/health`, `/api/instance` and `/api/setup`: public status of the instance and its first run. */
export async function systemRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	// Polled by container health checks, so it stays out of the request log.
	app.get("/health", { logLevel: "warn", ...access("public") }, async () => ({ status: "ok" }));

	app.get("/instance", access("public"), async (): Promise<InstanceInfo> => {
		const settings = services.settings.get();
		return {
			setupRequired: settings === null,
			instanceName: settings?.instanceName ?? null,
			issuer: services.config.issuer,
			version: services.config.version,
		};
	});

	/** Creates the first admin and signs it in. Afterwards the setup is closed for good. */
	app.post("/setup", access("public", rateLimits.strict), async (request, reply) => {
		const input = parseInput(setupRequestSchema, request.body);
		const { user, token, session } = await services.setup.complete(input, requestMeta(request));

		const account = await services.users.findSummary(user.id, new Date());
		if (!account) {
			throw notFound("Account");
		}

		services.sessionCookie.set(reply, token, session.expiresAt);
		return reply.code(201).send(toAuthSessionResponse(account, session, input.instanceName));
	});
}
