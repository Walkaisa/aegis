import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { type Locale, SUPPORTED_LOCALES } from "@aegis/contracts";
import fastifyStatic from "@fastify/static";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppConfig } from "../../config.js";
import { pageContentSecurityPolicy, RESOURCE_CONTENT_SECURITY_POLICY } from "../security.js";
import { isBackendPath, NOT_FOUND_PAGE, PageTable, resolvePage } from "./pages.js";

/** Bundles, styles and fonts carry a content hash in their name and never change. */
const IMMUTABLE_FILE = /^_next\/static\//;

/** Brand images that other sites embed, above all the logo in every e-mail Aegis sends. */
const EMBEDDABLE_FILE = /^(?:brand|icons)\//;

/** A segment payload that client-side navigation prefetches, e.g. `/users/123/__next._tree.txt`. */
const SEGMENT_PAYLOAD = /\/(__next\.[^/]+\.txt)$/;

interface ExportedPage {
	html: string;
	contentSecurityPolicy: string;
}

interface StaticExport {
	pages: PageTable;
	/** Keyed by the page's path in the export without extension, e.g. `de/users/[id]`. */
	documents: Map<string, ExportedPage>;
	payloads: Set<string>;
	files: Set<string>;
}

/** Path of a page in the export, without extension: `de` for `/`, `de/users/[id]` for `/users/<id>`. */
const exportPath = (locale: Locale, page: string) => (page === "" ? locale : `${locale}/${page}`);

/**
 * Client-side navigation loads a page's payload instead of its HTML: `/users/123.txt` (`/index.txt`
 * for `/`) and segments such as `/users/123/__next._tree.txt`. Returns the page's URL path and what
 * follows it in the export.
 */
function payloadRequest(path: string): { path: string; suffix: string } | null {
	const segment = SEGMENT_PAYLOAD.exec(path);
	if (segment) {
		return { path: path.slice(0, segment.index) || "/", suffix: `/${segment[1]}` };
	}
	if (path === "/index.txt") {
		return { path: "/", suffix: ".txt" };
	}
	return path.endsWith(".txt") ? { path: path.slice(0, -".txt".length), suffix: ".txt" } : null;
}

/**
 * Reads the static export of the frontend (`next build`, see `apps/frontend/next.config.ts`):
 *
 * - `<locale>.html`, `<locale>/**.html`: every page in every language, e.g. `de/users/[id]/settings.html`;
 *   kept in memory together with its Content Security Policy
 * - `<locale>.txt`, `<locale>/**.txt`: the payloads client-side navigation loads instead of pages
 * - `404.html`, `_not-found*`: Next.js' own 404 page, superseded by the localized `<locale>/404.html`
 * - everything else: static files, such as `_next/static/**` and the icons
 */
async function loadStaticExport(dir: string, config: AppConfig): Promise<StaticExport> {
	const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch((error: unknown) => {
		throw new Error(`The frontend has not been built: ${dir} is missing. Run \`pnpm build\` first.`, { cause: error });
	});
	const locales: ReadonlySet<string> = new Set(SUPPORTED_LOCALES);
	const documents = new Map<string, ExportedPage>();
	const payloads = new Set<string>();
	const files = new Set<string>();
	const pageNames = new Set<string>();

	for (const entry of entries.filter((candidate) => candidate.isFile())) {
		const file = relative(dir, join(entry.parentPath, entry.name)).split(sep).join("/");
		const [first = ""] = file.split("/", 1);
		const locale = file.includes("/") ? first : first.replace(/\.(?:html|txt)$/, "");

		if (!locales.has(locale)) {
			if (file !== "404.html" && !first.startsWith("_not-found")) {
				files.add(file);
			}
		} else if (file.endsWith(".txt")) {
			payloads.add(file);
		} else if (file.endsWith(".html")) {
			const path = file.slice(0, -".html".length);
			const html = await readFile(join(dir, file), "utf8");
			documents.set(path, { html, contentSecurityPolicy: pageContentSecurityPolicy(html, config) });
			pageNames.add(path === locale ? "" : path.slice(locale.length + 1));
		}
	}

	for (const locale of SUPPORTED_LOCALES) {
		if (!documents.has(exportPath(locale, NOT_FOUND_PAGE))) {
			throw new Error(`The frontend build in ${dir} is incomplete: ${exportPath(locale, NOT_FOUND_PAGE)}.html is missing.`);
		}
	}

	return { pages: new PageTable(pageNames), documents, payloads, files };
}

function sendStaticFile(reply: FastifyReply, file: string): FastifyReply {
	reply.header("content-security-policy", RESOURCE_CONTENT_SECURITY_POLICY);
	if (EMBEDDABLE_FILE.test(file)) {
		reply.header("cross-origin-resource-policy", "cross-origin");
	}
	return IMMUTABLE_FILE.test(file) ? reply.sendFile(file, { maxAge: "365d", immutable: true }) : reply.sendFile(file);
}

/**
 * Production: serves the static export of the frontend from `dir`. Static files come with their
 * cache headers; pages and payloads follow the gating and language rules in `pages.ts` and are
 * never cached, since they depend on the session and the chosen language. Only exported files are
 * ever read from disk.
 */
export async function serveStaticExport(app: FastifyInstance, dir: string): Promise<void> {
	const { services } = app;
	const { pages, documents, payloads, files } = await loadStaticExport(dir, services.config);

	await app.register(fastifyStatic, { root: dir, serve: false });

	// Pages and static files stay out of the request log.
	app.get("/*", { logLevel: "warn" }, async (request, reply) => {
		const url = new URL(request.url, "http://aegis.internal");
		if (isBackendPath(url.pathname)) {
			return reply.callNotFound();
		}

		const file = url.pathname.slice(1);
		if (files.has(file)) {
			return sendStaticFile(reply, file);
		}

		const payload = payloadRequest(url.pathname);
		if (payload) {
			// Pages the visitor may not open have no payload; the browser then loads the page itself and follows the redirect.
			const answer = await resolvePage(services, request, pages, new URL(`${payload.path}${url.search}`, url));
			if (answer.type !== "page" || answer.statusCode !== 200) {
				return reply.callNotFound();
			}
			const target = `${exportPath(answer.locale, answer.page)}${payload.suffix}`;
			if (!payloads.has(target)) {
				return reply.callNotFound();
			}
			return reply
				.header("cache-control", "no-store")
				.header("content-security-policy", RESOURCE_CONTENT_SECURITY_POLICY)
				.sendFile(target, { cacheControl: false, etag: false, lastModified: false });
		}

		const answer = await resolvePage(services, request, pages, url);
		if (answer.type === "redirect") {
			return reply.redirect(answer.location, answer.statusCode);
		}
		const document = documents.get(exportPath(answer.locale, answer.page));
		if (!document) {
			return reply.callNotFound();
		}
		return reply
			.code(answer.statusCode)
			.type("text/html; charset=utf-8")
			.header("cache-control", "no-store")
			.header("content-security-policy", document.contentSecurityPolicy)
			.send(document.html);
	});
}
