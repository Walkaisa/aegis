import type { Locale } from "@aegis/contracts";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LocalePreferenceProvider } from "@/components/locale-preference";
import { ThemeProvider } from "@/components/theme-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MESSAGES } from "./messages";

/** The route parameters Next.js hands to the layouts and pages below `app/[locale]`. */
export function localeProps(locale: string) {
	return { params: Promise.resolve({ locale }) };
}

/** Renders a page to HTML the way `next build` exports it, inside the providers of the root layout. */
export function renderExport(ui: ReactNode, locale: Locale = "en"): string {
	return renderToStaticMarkup(
		<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
			<LocalePreferenceProvider>
				<ThemeProvider>
					<TooltipProvider>{ui}</TooltipProvider>
				</ThemeProvider>
			</LocalePreferenceProvider>
		</NextIntlClientProvider>,
	);
}
