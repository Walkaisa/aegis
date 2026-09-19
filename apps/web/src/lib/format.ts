"use client";

import { useLocale } from "next-intl";
import { useMemo } from "react";

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
	["year", 60 * 60 * 24 * 365],
	["month", 60 * 60 * 24 * 30],
	["week", 60 * 60 * 24 * 7],
	["day", 60 * 60 * 24],
	["hour", 60 * 60],
	["minute", 60],
];

/** Locale-aware date formatting for client-rendered data. */
export function useDateFormat() {
	const locale = useLocale();

	return useMemo(() => {
		const dateTimeFormat = new Intl.DateTimeFormat(locale, {
			dateStyle: "medium",
			timeStyle: "short",
		});
		const dateFormat = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
		const timeFormat = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
		const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

		return {
			dateTime: (iso: string) => dateTimeFormat.format(new Date(iso)),
			date: (iso: string) => dateFormat.format(new Date(iso)),
			time: (iso: string) => timeFormat.format(new Date(iso)),
			relative: (iso: string) => {
				const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
				for (const [unit, size] of RELATIVE_UNITS) {
					if (Math.abs(seconds) >= size) {
						return relativeFormat.format(Math.round(seconds / size), unit);
					}
				}
				return relativeFormat.format(Math.round(seconds), "second");
			},
		};
	}, [locale]);
}
