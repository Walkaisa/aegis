export const SUPPORTED_LOCALES = ["de", "en"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Stores an explicit language choice. A missing cookie means "follow the system/browser". */
export const LOCALE_COOKIE = "aegis_locale";

export function isLocale(value: unknown): value is Locale {
	return value === "de" || value === "en";
}

/** The part of `value` before the first `separator`, or all of it. */
function before(value: string, separator: string): string {
	const end = value.indexOf(separator);
	return end === -1 ? value : value.slice(0, end);
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
				const quality = part
					.split(";")
					.slice(1)
					.map((param) => param.trim())
					.find((param) => param.startsWith("q="));
				return {
					// `de-AT;q=0.8` → `de`
					language: before(before(part, ";").trim().toLowerCase(), "-"),
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
