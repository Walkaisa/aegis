/** Pages outside the administration UI: sign-in (admin and OIDC), consent, results and setup. */
const AUTH_PAGES = new Set(["/sign-in", "/consent", "/error", "/signed-out", "/setup"]);

export function isAuthPage(pathname: string): boolean {
	return AUTH_PAGES.has(pathname);
}

/** Mirrors the server-side rule: only pages of the administration UI are valid destinations after signing in. */
export function safeAdminPath(value: string | null | undefined): string {
	if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
		return "/";
	}
	const path = value.split(/[?#]/, 1)[0] ?? "/";
	if (AUTH_PAGES.has(path) || /^\/(?:api|oauth2|\.well-known)(?:\/|$)/.test(path)) {
		return "/";
	}
	return value;
}

export function initials(name: string): string {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	const letters = parts.length > 1 ? [parts[0], parts.at(-1)] : [parts[0]];
	return letters
		.map((part) => (part ? Array.from(part)[0] : ""))
		.join("")
		.toLocaleUpperCase();
}
