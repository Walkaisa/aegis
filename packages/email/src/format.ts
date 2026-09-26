import type { Locale } from "@aegis/contracts";

/**
 * A point in time as it appears in a message. The recipient's time zone is unknown, so every
 * timestamp is written in UTC and says so — an unlabelled local time would be a guess.
 */
export function formatDateTime(date: Date, locale: Locale): string {
	const formatted = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
	return `${formatted} UTC`;
}

/** A duration such as "24 hours" or "30 Minuten", used to say how long a link stays valid. */
export function formatDuration(milliseconds: number, locale: Locale): string {
	const minutes = Math.round(milliseconds / 60_000);
	const [unit, value]: [Intl.NumberFormatOptions["unit"], number] =
		minutes % 1440 === 0 ? ["day", minutes / 1440] : minutes % 60 === 0 ? ["hour", minutes / 60] : ["minute", minutes];

	return new Intl.NumberFormat(locale, { style: "unit", unit, unitDisplay: "long" }).format(value);
}
