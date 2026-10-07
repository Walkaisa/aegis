import { hasPermission, LOCALE_COOKIE, type Locale, localPath, resolveLocale } from "@aegis/contracts";
import type { FastifyRequest } from "fastify";
import type { AppServices } from "../../services/container.js";
import { getSession } from "../access.js";

/** Namespaces of the backend itself (`api/`, `oidc.ts`). The frontend never answers below them, not even with its 404 page. */
const BACKEND_PATH = /^\/(?:api|oauth2|\.well-known)(?:\/|$)/;

/**
 * Pages outside the administration: sign-in (administration and applications), consent, results,
 * and the pages reached from a link in an e-mail. The latter must stay reachable without a
 * session — a confirmation link is usually opened wherever the mailbox is.
 */
const PUBLIC_PAGES = new Set(["/sign-in", "/consent", "/error", "/signed-out", "/forgot-password", "/reset-password", "/verify-email"]);

/** The page that answers every URL without a page of its own, exported as `<locale>/404.html`. */
export const NOT_FOUND_PAGE = "404";

/**
 * The sign-in for an application. It shares `/sign-in?challenge=` with the sign-in to the
 * administration, the URL oidc-provider leads to, but has an export of its own, so each shows the
 * right form before any JavaScript runs. It has no URL of its own.
 */
const APPLICATION_SIGN_IN_PAGE = "sign-in/application";

/** Pages that are only ever served in place of another one. */
const HIDDEN_PAGES: ReadonlySet<string> = new Set([NOT_FOUND_PAGE, APPLICATION_SIGN_IN_PAGE]);

export function isBackendPath(path: string): boolean {
	return BACKEND_PATH.test(path);
}

/** Post sign-in destinations: pages of the administration UI only, never external URLs. */
export function safeReturnPath(value: string | null | undefined): string {
	const target = localPath(value);
	if (!target || PUBLIC_PAGES.has(target.pathname) || target.pathname === "/setup" || isBackendPath(target.pathname)) {
		return "/";
	}
	return target.path;
}

interface RouteNode {
	readonly segments: Map<string, RouteNode>;
	parameter: RouteNode | null;
	page: string | null;
}

const createNode = (): RouteNode => ({ segments: new Map(), parameter: null, page: null });

const splitPath = (path: string): string[] => (path === "" ? [] : path.split("/"));

function matchNode(node: RouteNode, segments: string[], index: number): string | null {
	const segment = segments[index];
	if (segment === undefined) {
		return node.page;
	}
	const exact = node.segments.get(segment);
	const page = exact ? matchNode(exact, segments, index + 1) : null;
	if (page !== null || segment === "" || !node.parameter) {
		return page;
	}
	return matchNode(node.parameter, segments, index + 1);
}

/**
 * The pages of the frontend by URL. A page is named like its route below `app/[locale]`, without
 * route groups: `users/[id]/settings` answers `/users/<id>/settings`, `""` answers `/`. Static
 * segments take precedence over parameters, so `/users/new` is not an account.
 */
export class PageTable {
	private readonly root = createNode();

	public constructor(pages: Iterable<string>) {
		for (const page of pages) {
			if (HIDDEN_PAGES.has(page)) {
				continue;
			}
			let node = this.root;
			for (const segment of splitPath(page)) {
				if (segment.startsWith("[")) {
					node.parameter ??= createNode();
					node = node.parameter;
					continue;
				}
				let next = node.segments.get(segment);
				if (!next) {
					next = createNode();
					node.segments.set(segment, next);
				}
				node = next;
			}
			node.page = page;
		}
	}

	/** The page for a URL path such as `/users/123`, or `null` if there is none. */
	public match(path: string): string | null {
		return matchNode(this.root, splitPath(path.slice(1)), 0);
	}
}

/**
 * Server-side page gating: without settings every page leads to the setup; once set up, the setup
 * is closed for good and every page except the public ones belongs to the administration and
 * requires a session with `console:access`.
 */
async function pageRedirect(services: AppServices, request: FastifyRequest, url: URL): Promise<string | null> {
	const mayUseConsole = async () => {
		const session = await getSession(services, request);
		return session !== null && hasPermission(session.user.role, "console:access");
	};

	const path = url.pathname;
	if (!services.settings.isSetupComplete()) {
		return path === "/setup" ? null : "/setup";
	}
	if (path === "/setup") {
		return "/sign-in";
	}

	if (PUBLIC_PAGES.has(path)) {
		// A sign-in for an application (`?challenge=`) is completed on the page itself.
		if (path === "/sign-in" && !url.searchParams.has("challenge") && (await mayUseConsole())) {
			return safeReturnPath(url.searchParams.get("next"));
		}
		return null;
	}

	if (await mayUseConsole()) {
		return null;
	}
	const target = `${path}${url.search}`;
	return target === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(target)}`;
}

/** How to answer a request for a page: with the page in the visitor's language, or a redirect. */
export type PageResponse =
	| { type: "page"; page: string; locale: Locale; statusCode: 200 | 404 }
	| { type: "redirect"; location: string; statusCode: 303 | 308 };

/**
 * Answers a request for the page at `url`: URLs without a trailing slash are canonical, then the
 * gating above applies, then the page is served, or the 404 page if there is none. The language
 * is the one chosen in the preference cookie, otherwise the browser's.
 */
export async function resolvePage(services: AppServices, request: FastifyRequest, pages: PageTable, url: URL): Promise<PageResponse> {
	if (url.pathname !== "/" && url.pathname.endsWith("/")) {
		// Rebuilt from its segments, so the target can never start with `//`, which would be another host.
		const path = `/${url.pathname.split("/").filter(Boolean).join("/")}`;
		return { type: "redirect", location: `${path}${url.search}`, statusCode: 308 };
	}

	const redirect = await pageRedirect(services, request, url);
	if (redirect) {
		return { type: "redirect", location: redirect, statusCode: 303 };
	}

	const locale = resolveLocale(request.cookies[LOCALE_COOKIE], request.headers["accept-language"]);
	const page = url.pathname === "/sign-in" && url.searchParams.has("challenge") ? APPLICATION_SIGN_IN_PAGE : pages.match(url.pathname);
	if (page === null) {
		return { type: "page", page: NOT_FOUND_PAGE, locale, statusCode: 404 };
	}
	return { type: "page", page, locale, statusCode: 200 };
}
