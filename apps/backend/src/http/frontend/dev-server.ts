import { readdir } from "node:fs/promises";
import { basename, dirname, sep } from "node:path";
import type { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import fastifyHttpProxy from "@fastify/http-proxy";
import type { FastifyInstance, FastifyReply, RawServerBase, RouteGenericInterface } from "fastify";
import type { AppConfig } from "../../config.js";
import { notFound } from "../../lib/errors.js";
import { pageContentSecurityPolicy } from "../security.js";
import { isBackendPath, PageTable, resolvePage } from "./pages.js";

/** Where `pnpm dev` starts the Next.js development server, see `apps/frontend/package.json`. */
const DEV_SERVER = "http://127.0.0.1:3001";

/** Bundles, hot reloading and the error overlay of the development server, proxied as they are. */
const DEV_SERVER_PATH = /^\/(?:_next\/|__nextjs)/;

/** A file rather than a page, such as `/favicon.ico`: its last segment has an extension. */
const FILE_PATH = /\.[^/]*$/;

const PAGE_FILE = /^page\.[jt]sx?$/;
const ROUTE_GROUP = /^\(.+\)$/;

/**
 * Sends a page of the development server with the policy for its inline scripts, like the export
 * gets; a page that breaks off ends in the error handler instead.
 */
export function sendPage(reply: FastifyReply<RouteGenericInterface, RawServerBase>, page: Readable, config: AppConfig): Promise<void> {
	return text(page).then(
		(html) => {
			reply.removeHeader("content-length");
			reply.header("content-security-policy", pageContentSecurityPolicy(html, config)).send(html);
		},
		(error: unknown) => {
			reply.send(error);
		},
	);
}

/** The pages below `app/[locale]`, read on every request so that a new page works without a restart. */
async function readPages(appDir: string): Promise<string[]> {
	const files = await readdir(appDir, { recursive: true });
	return files
		.filter((file) => PAGE_FILE.test(basename(file)))
		.map((file) =>
			dirname(file)
				.split(sep)
				.filter((segment) => segment !== "." && !ROUTE_GROUP.test(segment))
				.join("/"),
		);
}

/**
 * Development: proxies the Next.js development server, which `pnpm dev` starts next to this one,
 * including the WebSocket for hot reloading. Pages follow the same gating and language rules as in
 * production; the request is rewritten to the route the static export would serve, e.g.
 * `/users/123` to `/de/users/[id]`. `appDir` is the frontend's `app/[locale]` directory.
 */
export async function serveDevServer(app: FastifyInstance, appDir: string, upstream = DEV_SERVER): Promise<void> {
	const { services } = app;
	// Keyed by the request; the proxy's response hook types it more loosely than the route does.
	const routes = new WeakMap<object, { path: string; statusCode: number }>();

	await app.register(fastifyHttpProxy, {
		upstream,
		prefix: "/",
		websocket: true,
		// Pages, bundles and proxy details stay out of the request log.
		logLevel: "warn",
		preHandler: async (request, reply) => {
			const url = new URL(request.url, "http://aegis.internal");
			if (isBackendPath(url.pathname)) {
				throw notFound("Route");
			}
			if (DEV_SERVER_PATH.test(url.pathname)) {
				return;
			}
			if (request.method !== "GET" && request.method !== "HEAD") {
				throw notFound("Route");
			}

			const pages = new PageTable(await readPages(appDir));
			if (FILE_PATH.test(url.pathname) && pages.match(url.pathname) === null) {
				return;
			}

			const answer = await resolvePage(services, request, pages, url);
			if (answer.type === "redirect") {
				return reply.redirect(answer.location, answer.statusCode);
			}
			// Page names come from the file system; the development server expects parameters such as `[id]` verbatim.
			const path = answer.page === "" ? `/${answer.locale}` : `/${answer.locale}/${answer.page}`;
			routes.set(request, { path: `${path}${url.search}`, statusCode: answer.statusCode });
		},
		handler: (request, reply, dest, options) => reply.from(routes.get(request)?.path ?? dest, options),
		replyOptions: {
			// Pages have to arrive uncompressed to hash their inline scripts.
			rewriteRequestHeaders: (_request, headers) => {
				const { "accept-encoding": _encoding, ...rest } = headers;
				return rest;
			},
			onResponse: (request, reply, response) => {
				if (routes.get(request)?.statusCode === 404) {
					reply.code(404);
				}
				if (!String(reply.getHeader("content-type") ?? "").startsWith("text/html")) {
					reply.send(response.stream);
					return;
				}
				void sendPage(reply, response.stream, services.config);
			},
		},
	});
}
