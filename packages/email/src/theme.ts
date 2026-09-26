/**
 * The e-mail palette, mirroring the web UI's tokens (`apps/web/src/app/globals.css`) converted to
 * hex: e-mail clients understand neither `oklch()` nor CSS variables, so every colour is written
 * out. Light values are inlined on the elements, dark values are applied through the class names
 * below in a `prefers-color-scheme` block — the only dark-mode mechanism most clients support.
 */

export interface EmailPalette {
	background: string;
	card: string;
	border: string;
	foreground: string;
	muted: string;
	mutedForeground: string;
	subtle: string;
	primary: string;
	primaryForeground: string;
}

export const LIGHT: EmailPalette = {
	background: "#f4f5f9",
	card: "#ffffff",
	border: "#e0e3e8",
	foreground: "#141822",
	muted: "#f0f2f7",
	mutedForeground: "#646974",
	subtle: "#8b909b",
	primary: "#4a59d5",
	primaryForeground: "#ffffff",
};

export const DARK: EmailPalette = {
	background: "#0f1116",
	card: "#15181d",
	border: "#26292f",
	foreground: "#f2f3f6",
	muted: "#1f2228",
	mutedForeground: "#9a9fa8",
	subtle: "#80858e",
	primary: "#7a8ff7",
	primaryForeground: "#0d111f",
};

/** Class names the dark-mode block hooks into; each one has its light counterpart inlined. */
export const SURFACE = {
	body: "ae-body",
	card: "ae-card",
	panel: "ae-panel",
	heading: "ae-heading",
	text: "ae-text",
	muted: "ae-muted",
	subtle: "ae-subtle",
	link: "ae-link",
	button: "ae-button",
	brand: "ae-brand",
	container: "ae-container",
	gutter: "ae-gutter",
} as const;

/** Plain, widely available fonts; a web font would simply not load in most clients. */
export const FONT_STACK =
	'-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"';

export const MONO_STACK = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export const CONTENT_WIDTH = 560;

/**
 * The stylesheet in `<head>`: resets that keep Outlook and Gmail in line, the responsive rules for
 * narrow screens, and the dark-mode overrides. Everything else is inlined on the elements, because
 * a `<style>` block alone is discarded by several clients.
 */
export function styleSheet(): string {
	return `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin: 0; padding: 0; width: 100% !important; -ms-text-size-adjust: 100%; -webkit-text-size-adjust: 100%; }
table { border-collapse: collapse; }
img { border: 0; line-height: 100%; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; }
a { color: ${LIGHT.primary}; }
.${SURFACE.button} a { text-decoration: none !important; }
/* Stop Apple Mail and Outlook from turning addresses, dates and links into blue system links. */
a[x-apple-data-detectors], .unstyle-auto-detected-links a, .aolmail_body a {
	color: inherit !important; text-decoration: none !important; font-size: inherit !important;
	font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important;
}
@media only screen and (max-width: 620px) {
	.${SURFACE.container} { width: 100% !important; }
	.${SURFACE.gutter} { padding-left: 24px !important; padding-right: 24px !important; }
}
@media (prefers-color-scheme: dark) {
	.${SURFACE.body} { background-color: ${DARK.background} !important; }
	.${SURFACE.card} { background-color: ${DARK.card} !important; border-color: ${DARK.border} !important; }
	.${SURFACE.panel} { background-color: ${DARK.muted} !important; border-color: ${DARK.border} !important; }
	.${SURFACE.heading}, .${SURFACE.text} { color: ${DARK.foreground} !important; }
	.${SURFACE.muted} { color: ${DARK.mutedForeground} !important; }
	.${SURFACE.subtle} { color: ${DARK.subtle} !important; }
	.${SURFACE.link}, .${SURFACE.link} a { color: ${DARK.primary} !important; }
	.${SURFACE.brand} { color: ${DARK.foreground} !important; }
	.${SURFACE.button} { background-color: ${DARK.primary} !important; }
	.${SURFACE.button} a { color: ${DARK.primaryForeground} !important; }
}
`.trim();
}
