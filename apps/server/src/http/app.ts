import { API_PREFIX } from "@aegis/contracts";
import fastifyCookie from "@fastify/cookie";
import fastifyHelmet from "@fastify/helmet";
import fastifyRateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest, LogController } from "fastify";
import type { AppConfig } from "../config.js";
import { openDatabase } from "../db/database.js";
import { ApiError, notFound } from "../lib/errors.js";
import { newId } from "../lib/snowflakes.js";
import { type AppServices, createServices } from "../services/container.js";
import { apiRoutes } from "./api/index.js";
import { errorHandler } from "./error-handler.js";
import { oidcRoutes } from "./oidc.js";
import { webRoutes } from "./web.js";

declare module "fastify" {
	interface FastifyInstance {
		/** Repositories and services, available to every plugin as `app.services`. */
		services: AppServices;
	}
}

/**
 * Logs a completed request without its query string, which may contain e-mail addresses
 * (`login_hint`). Routes with a higher `logLevel`, such as health checks and pages, stay quiet.
 */
async function logRequest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
	request.log.info(
		{
			method: request.method,
			path: request.url.split("?")[0],
			statusCode: reply.statusCode,
			responseTimeMs: Math.round(reply.elapsedTime),
		},
		"request completed",
	);
}

/**
 * Builds the Aegis server. Every request belongs to exactly one of three areas:
 *
 * - `/api/*`: the JSON API of the web UI (`api/`)
 * - `/.well-known/*`, `/oauth2/*`: the OpenID Connect protocol (`oidc.ts`)
 * - everything else: pages and assets of the web UI (`web.ts`)
 */
export async function buildApp(config: AppConfig): Promise<{ app: FastifyInstance; services: AppServices }> {
	const app = Fastify({
		logger: {
			level: config.logLevel,
			redact: {
				paths: ["req.headers.authorization", "req.headers.cookie", 'res.headers["set-cookie"]'],
				censor: "[redacted]",
			},
		},
		trustProxy: config.trustProxy,
		bodyLimit: 64 * 1024,
		// Requests are logged by `logRequest`, without query strings.
		logController: new LogController({ disableRequestLogging: true }),
		requestIdHeader: false,
		genReqId: () => newId(),
		return503OnClosing: true,
	});

	const database = await openDatabase(config.databaseUrl, app.log);
	app.addHook("onClose", async () => {
		await database.close();
	});

	const services = createServices(config, database, app.log);
	await services.settings.refresh();
	app.decorate("services", services);

	// Only JSON bodies are accepted by Aegis' own endpoints.
	app.removeContentTypeParser("text/plain");
	app.setErrorHandler(errorHandler);
	app.setNotFoundHandler((_request, reply) => {
		void reply.code(404).send(notFound("Route").toBody());
	});

	await app.register(fastifyCookie);
	await app.register(fastifyHelmet, {
		// Content-Security-Policy is set per response type (API, pages, provider-rendered HTML).
		contentSecurityPolicy: false,
		crossOriginEmbedderPolicy: false,
		strictTransportSecurity: config.secureCookies ? { maxAge: 31_536_000 } : false,
	});
	await app.register(fastifyRateLimit, {
		global: false,
		errorResponseBuilder: (_request, context) => new ApiError(429, "rate_limited", `Rate limit exceeded, retry in ${context.after}`),
	});
	app.addHook("onResponse", logRequest);

	await app.register(apiRoutes, { prefix: API_PREFIX });
	await app.register(oidcRoutes);
	await app.register(webRoutes);

	return { app, services };
}
