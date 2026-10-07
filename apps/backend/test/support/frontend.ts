import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/** The inline script of an exported page; its hash belongs into the page's Content Security Policy. */
export function inlineScript(page: string, locale: string): string {
	return `self.__page=${JSON.stringify(`${locale}:${page}`)}`;
}

export function scriptHash(script: string): string {
	return `'sha256-${createHash("sha256").update(script).digest("base64")}'`;
}

const document = (page: string, locale: string) =>
	`<!DOCTYPE html><html lang="${locale}"><head><script>${inlineScript(page, locale)}</script></head><body>${locale}:${page}</body></html>`;

/** Pages of the fixture, named like the routes below `app/[locale]`. */
export const FIXTURE_PAGES = ["", "404", "setup", "sign-in", "sign-in/application", "users", "users/[id]", "users/new"];

/**
 * A static export as `next build` writes it to `apps/frontend/out`, with a handful of pages in both
 * languages, their payloads, Next.js' own 404 page and some static files. Returns the frontend
 * directory (`out` is below it) and a function that removes it.
 */
export async function createStaticExport(options: { omit?: string[]; extra?: Record<string, string> } = {}) {
	const root = await mkdtemp(join(tmpdir(), "aegis-frontend-"));
	const files: Record<string, string> = {
		"404.html": "<!DOCTYPE html><html><body>Next.js 404</body></html>",
		"_not-found.html": "<!DOCTYPE html><html><body>Next.js not found</body></html>",
		"_not-found/__next._tree.txt": "not found tree",
		"_next/static/chunks/app.js": "console.log('app')",
		"brand/logo.svg": "<svg xmlns='http://www.w3.org/2000/svg'/>",
		"favicon.ico": "icon",
		...options.extra,
	};
	for (const locale of ["de", "en"]) {
		for (const page of FIXTURE_PAGES) {
			const path = page === "" ? locale : `${locale}/${page}`;
			files[`${path}.html`] = document(page, locale);
			files[`${path}.txt`] = `payload ${locale}:${page}`;
		}
		files[`${locale}/users/[id]/__next._tree.txt`] = `tree ${locale}:users/[id]`;
	}
	for (const file of options.omit ?? []) {
		delete files[file];
	}

	for (const [file, content] of Object.entries(files)) {
		const path = join(root, "out", file);
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, content);
	}
	return { root, remove: () => rm(root, { recursive: true, force: true }) };
}
