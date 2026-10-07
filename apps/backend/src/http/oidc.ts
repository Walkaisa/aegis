import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../lib/errors.js";
import { type AegisIncomingMessage, JWKS_PATH, OIDC_PATH_PREFIX } from "../oidc/provider.js";
import { rateLimits } from "./rate-limits.js";

/**
 * `/.well-known/openid-configuration`, `/.well-known/jwks.json` and `/oauth2/*`: the OpenID Connect
 * protocol, handled by oidc-provider. This scope removes Fastify's body parsers so the raw request
 * stream reaches oidc-provider untouched, and the reply is hijacked so that the provider writes the
 * response itself.
 */
export async function oidcRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	app.removeAllContentTypeParsers();
	app.addContentTypeParser("*", (_request, _payload, done) => {
		done(null);
	});

	const handler = async (request: FastifyRequest, reply: FastifyReply) => {
		if (!services.oidc.provider) {
			throw new ApiError(503, "setup_required", "The initial setup has not been completed");
		}

		(request.raw as AegisIncomingMessage).aegisClientIp = request.ip;
		reply.hijack();

		try {
			await services.oidc.handle(request.raw, reply.raw);
		} catch (error) {
			request.log.error({ err: error }, "OpenID provider request failed");
			if (!reply.raw.headersSent) {
				reply.raw.statusCode = 500;
				reply.raw.setHeader("content-type", "application/json");
				reply.raw.end(JSON.stringify({ error: "server_error" }));
			}
		}
	};

	const options = { config: { rateLimit: rateLimits.protocol } };
	app.all("/.well-known/openid-configuration", options, handler);
	app.all(JWKS_PATH, options, handler);
	app.all(`${OIDC_PATH_PREFIX}/*`, options, handler);
}
