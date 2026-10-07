/**
 * Full page loads, as opposed to client-side navigation with the router. They are used where the
 * current page is left for good: after signing in or out, to continue an authorization request at
 * the provider, and to show a page again, e.g. in another language.
 */
export function loadPage(url: string): void {
	window.location.assign(url);
}

export function reloadPage(): void {
	window.location.reload();
}
