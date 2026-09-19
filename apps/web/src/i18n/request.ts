import { LOCALE_COOKIE, type Locale, resolveLocale } from "@aegis/contracts";
import { cookies, headers } from "next/headers";
import type { AbstractIntlMessages } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import de from "../messages/de.json";
import en from "../messages/en.json";

const messages = { de, en } satisfies Record<Locale, AbstractIntlMessages>;

/**
 * Locale selection without URL prefixes: an explicit choice stored in a cookie wins,
 * otherwise the browser's Accept-Language header decides ("System").
 */
export default getRequestConfig(async () => {
	const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
	const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerStore.get("accept-language"));

	return {
		locale,
		messages: messages[locale],
	};
});
