"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * The script of next-themes applies the theme before the first paint, so it only matters in the
 * exported HTML. A tree that is rendered in the browser instead of hydrated gets it as inert data,
 * which React accepts; the attribute differs from the export like the script's nonce does.
 */
const SCRIPT_PROPS = typeof window === "undefined" ? undefined : { type: "application/json" };

export function ThemeProvider({ children }: { children: ReactNode }) {
	return (
		<NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange scriptProps={SCRIPT_PROPS}>
			{children}
		</NextThemesProvider>
	);
}
