import { LOCALE_COOKIE, type Locale, resolveLocale } from "@aegis/contracts";
import type { KoaContextWithOIDC } from "oidc-provider";

const STRINGS: Record<
	Locale,
	{
		title: string;
		question: (instanceName: string) => string;
		clientRequest: (clientName: string, instanceName: string) => string;
		confirm: string;
		cancel: string;
		securedBy: string;
	}
> = {
	de: {
		title: "Abmelden",
		question: (instanceName) => `Möchtest du dich von ${instanceName} abmelden?`,
		clientRequest: (clientName, instanceName) =>
			`„${clientName}“ möchte dich von ${instanceName} abmelden. Danach musst du dich in deinen Anwendungen erneut anmelden.`,
		confirm: "Abmelden",
		cancel: "Angemeldet bleiben",
		securedBy: "Geschützt durch Aegis · OpenID Connect",
	},
	en: {
		title: "Sign out",
		question: (instanceName) => `Do you want to sign out of ${instanceName}?`,
		clientRequest: (clientName, instanceName) =>
			`“${clientName}” wants to sign you out of ${instanceName}. You will have to sign in again in all connected applications.`,
		confirm: "Sign out",
		cancel: "Stay signed in",
		securedBy: "Secured by Aegis · OpenID Connect",
	},
};

function escapeHtml(value: string): string {
	return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const SVG_ATTRIBUTES = `xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
const LOGOUT_ICON = `<svg ${SVG_ATTRIBUTES} width="20" height="20"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>`;

/** Mirrors the design tokens of the web UI; this page cannot load its stylesheet. */
const STYLES = `
:root{color-scheme:light dark;--bg:#fcfcfe;--card:#fff;--fg:#1e2030;--muted:#6b6f82;--border:#e3e5ec;--subtle:#f3f4f8;--primary:#5046e5;--primary-fg:#fff;--ring:#8187f0;--grid:rgba(30,32,48,.06);--glow:rgba(80,70,229,.16)}
@media (prefers-color-scheme:dark){:root{--bg:#16171e;--card:#1c1d26;--fg:#f2f3f7;--muted:#a4a7b8;--border:rgba(255,255,255,.09);--subtle:#23242e;--primary:#8c8ff5;--primary-fg:#171830;--ring:#6d72e8;--grid:rgba(255,255,255,.05);--glow:rgba(140,143,245,.16)}}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5rem 1rem;color:var(--fg);font:14px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:radial-gradient(ellipse 50% 45% at 50% 0%,var(--glow),transparent 70%),var(--bg)}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;background-image:linear-gradient(to right,var(--grid) 1px,transparent 1px),linear-gradient(to bottom,var(--grid) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse 70% 55% at 50% 30%,#000 20%,transparent 75%);mask-image:radial-gradient(ellipse 70% 55% at 50% 30%,#000 20%,transparent 75%)}
main{width:100%;max-width:26.25rem}
.brand{display:flex;align-items:center;justify-content:center;gap:.625rem;margin-bottom:1.5rem;font-size:.875rem;font-weight:600;letter-spacing:-.01em}
.mark{display:block;width:1.75rem;height:1.75rem;border-radius:.4rem;background:#191a1c}
.card{overflow:hidden;background:var(--card);border:1px solid var(--border);border-radius:1rem;box-shadow:0 1px 2px rgb(0 0 0/.04),0 16px 48px -16px rgb(0 0 0/.18)}
.body{padding:2rem 2.5rem;text-align:center}
.icon{display:grid;place-items:center;width:2.75rem;height:2.75rem;margin:0 auto 1.25rem;border:1px solid var(--border);border-radius:.75rem;background:var(--subtle);color:var(--muted)}
h1{margin:0 0 .375rem;font-size:1.25rem;line-height:1.4;letter-spacing:-.015em}
p{margin:0 0 1.75rem;color:var(--muted)}
.actions{display:grid;gap:.5rem}
button{height:2.5rem;padding:0 1rem;border:1px solid var(--border);border-radius:.625rem;background:transparent;color:var(--fg);font:inherit;font-weight:500;cursor:pointer}
button:hover{background:var(--subtle)}
button.primary{border-color:var(--primary);background:var(--primary);color:var(--primary-fg)}
button.primary:hover{opacity:.9}
button:focus-visible{outline:2px solid var(--ring);outline-offset:2px}
footer{margin-top:1.5rem;text-align:center;font-size:.75rem;color:var(--muted)}
@media (max-width:30rem){.body{padding:1.75rem 1.5rem}}
`;

/**
 * Renders the RP-initiated logout confirmation. It is served by oidc-provider directly because
 * the form carries the provider's XSRF token; it needs no JavaScript.
 */
export function renderSignOutPage(ctx: KoaContextWithOIDC, form: string, instanceName: string): void {
	const locale = resolveLocale(ctx.cookies.get(LOCALE_COOKIE, { signed: false }), ctx.get("accept-language"));
	const t = STRINGS[locale];
	const clientName = ctx.oidc.client?.clientName;
	const message = clientName ? t.clientRequest(clientName, instanceName) : t.question(instanceName);

	ctx.type = "html";
	ctx.set("Cache-Control", "no-store");
	ctx.set(
		"Content-Security-Policy",
		"default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; manifest-src 'self'; base-uri 'none'; frame-ancestors 'none'",
	);
	ctx.body = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<meta name="theme-color" content="#191a1c">
<meta name="application-name" content="Aegis">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Aegis">
<link rel="icon" href="/icons/icon.svg" type="image/svg+xml" sizes="any">
<link rel="icon" href="/icons/icon-96.png" type="image/png" sizes="96x96">
<link rel="icon" href="/favicon.ico" sizes="16x16 32x32 48x48">
<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180">
<link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#191a1c">
<link rel="manifest" href="/manifest.webmanifest">
<title>${escapeHtml(t.title)} · ${escapeHtml(instanceName)}</title>
<style>${STYLES}</style>
</head>
<body>
<main>
<div class="brand"><img class="mark" src="/brand/logo.svg" width="28" height="28" alt=""><span>${escapeHtml(instanceName)}</span></div>
<div class="card">
<div class="body">
<div class="icon">${LOGOUT_ICON}</div>
<h1>${escapeHtml(t.title)}</h1>
<p>${escapeHtml(message)}</p>
${form}
<div class="actions">
<button class="primary" type="submit" form="op.logoutForm" name="logout" value="yes" autofocus>${escapeHtml(t.confirm)}</button>
<button type="submit" form="op.logoutForm">${escapeHtml(t.cancel)}</button>
</div>
</div>
</div>
<footer>${escapeHtml(t.securedBy)}</footer>
</main>
</body>
</html>`;
}
