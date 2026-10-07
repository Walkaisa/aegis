import { DEFAULT_LOCALE, isLocale, type Locale } from "@aegis/contracts";
import { locale as routeLocale } from "next/root-params";
import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import de from "../messages/de.json";
import en from "../messages/en.json";

const messages = { de, en } satisfies Record<Locale, AbstractIntlMessages>;

/**
 * Every page is exported once per locale (`app/[locale]`), so the locale is a root parameter of the
 * route; a locale passed explicitly, as in `getTranslations({ locale })`, takes precedence. URLs carry
 * no locale prefix: the backend serves the export that matches the language chosen in a cookie or,
 * without a choice, the browser's Accept-Language header ("System").
 */
export default getRequestConfig(async ({ locale: explicit }) => {
	const requested = explicit ?? (await routeLocale());
	const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

	return {
		locale,
		messages: messages[locale],
	};
});
