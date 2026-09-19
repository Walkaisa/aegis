/**
 * Every icon is a static file in `apps/web/public`, regenerated from `public/brand/logo.svg` by
 * `pnpm --filter @aegis/web brand:generate`. Next.js' file-based icon convention (`app/icon.png`
 * and friends) is deliberately not used: its URLs carry a build hash, while `apps/server` renders
 * the OpenID Connect sign-out page outside of Next.js and has to link the same icons by a stable
 * path. One source of truth beats two.
 */

/** The dark square the mark sits on. Also the browser theme and PWA background colour. */
export const BRAND_COLOR = "#191a1c";

export const BRAND_LOGO = "/brand/logo.svg";

/** `/favicon.ico` and `/apple-touch-icon.png` stay at the root: clients request them unprompted. */
export const BRAND_ICONS = {
	favicon: "/favicon.ico",
	svg: "/icons/icon.svg",
	png: "/icons/icon-96.png",
	appleTouch: "/apple-touch-icon.png",
	maskable192: "/icons/icon-192.png",
	maskable512: "/icons/icon-512.png",
	safariPinnedTab: "/icons/safari-pinned-tab.svg",
} as const;
