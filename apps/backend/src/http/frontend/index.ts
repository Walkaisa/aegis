import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { serveStaticExport } from "./static-export.js";

/**
 * Everything that is neither API nor protocol: the pages and files of the frontend
 * (`apps/frontend`), so the browser only ever talks to a single origin.
 *
 * - production: its static export, served from `out`; there is no Next.js server at runtime
 * - development: its Next.js development server, for hot reloading (`dev-server.ts`)
 */
export async function frontendRoutes(app: FastifyInstance): Promise<void> {
	const { config } = app.services;
	if (config.isProduction) {
		await serveStaticExport(app, join(config.frontendDir, "out"));
		return;
	}

	// Loaded on demand: the proxy is a development dependency and not part of the Docker image.
	const { serveDevServer } = await import("./dev-server.js");
	await serveDevServer(app, join(config.frontendDir, "src", "app", "[locale]"));
}
