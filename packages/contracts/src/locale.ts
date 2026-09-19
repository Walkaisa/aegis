export const SUPPORTED_LOCALES = ["de", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Stores an explicit language choice. A missing cookie means "follow the system/browser". */
export const LOCALE_COOKIE = "aegis_locale";

export function isLocale(value: unknown): value is Locale {
	return value === "de" || value === "en";
}

/**
 * Resolves the UI language from an explicit preference cookie or, failing that,
 * from the browser's Accept-Language header.
 */
export function resolveLocale(preference: string | null | undefined, acceptLanguage: string | null | undefined): Locale {
	if (isLocale(preference)) {
		return preference;
	}

	if (acceptLanguage) {
		const ranked = acceptLanguage
			.split(",")
			.map((part, index) => {
				const [tag = "", ...params] = part.trim().split(";");
				const quality = params.map((param) => param.trim()).find((param) => param.startsWith("q="));
				return {
					language: tag.trim().toLowerCase().split("-")[0] ?? "",
					quality: quality ? Number(quality.slice(2)) : 1,
					index,
				};
			})
			.filter((entry) => entry.language && Number.isFinite(entry.quality) && entry.quality > 0)
			.sort((a, b) => b.quality - a.quality || a.index - b.index);

		for (const entry of ranked) {
			if (isLocale(entry.language)) {
				return entry.language;
			}
		}
	}

	return DEFAULT_LOCALE;
}
