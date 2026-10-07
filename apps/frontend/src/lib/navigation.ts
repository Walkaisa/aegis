import { localPath } from "@aegis/contracts";

/** Pages outside the administration UI: sign-in (admin and OIDC), consent, results, setup and the pages reached from an e-mail. */
const AUTH_PAGES = new Set([
	"/sign-in",
	"/consent",
	"/error",
	"/signed-out",
	"/setup",
	"/forgot-password",
	"/reset-password",
	"/verify-email",
]);

export function isAuthPage(pathname: string): boolean {
	return AUTH_PAGES.has(pathname);
}

/** Mirrors the server-side rule: only pages of the administration UI are valid destinations after signing in. */
export function safeAdminPath(value: string | null | undefined): string {
	const target = localPath(value);
	if (!target || AUTH_PAGES.has(target.pathname) || /^\/(?:api|oauth2|\.well-known)(?:\/|$)/.test(target.pathname)) {
		return "/";
	}
	return target.path;
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : [parts[0]];
	return letters
		.map((part) => (part ? Array.from(part)[0] : ""))
		.join("")
		.toLocaleUpperCase();
}
