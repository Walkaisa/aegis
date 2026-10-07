import { DEFAULT_LOCALE, isLocale, type Locale } from "@aegis/contracts";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

/** Route parameters of every layout and page below `app/[locale]`. */
export interface LocaleProps {
	params: Promise<{ locale: string }>;
}

/** The locale of a page. The export only contains supported ones (`generateStaticParams`, `dynamicParams`). */
export async function localeOf({ params }: LocaleProps): Promise<Locale> {
	const { locale } = await params;
	return isLocale(locale) ? locale : DEFAULT_LOCALE;
}

/** `generateMetadata` of a page titled by a message: `export const generateMetadata = pageTitle("users", "title")`. */
export function pageTitle(namespace: string, key: string) {
	return async (props: LocaleProps): Promise<Metadata> => {
		const t = await getTranslations({ locale: await localeOf(props), namespace });
		return { title: t(key) };
	};
}
