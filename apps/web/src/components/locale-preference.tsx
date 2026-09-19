"use client";

import { LOCALE_COOKIE, type Locale } from "@aegis/contracts";
import { useRouter } from "next/navigation";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState, useTransition } from "react";

export type LocalePreference = Locale | "system";

interface LocalePreferenceContextValue {
	preference: LocalePreference;
	setPreference: (preference: LocalePreference) => void;
	pending: boolean;
}

const LocalePreferenceContext = createContext<LocalePreferenceContextValue | null>(null);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function writeCookie(preference: LocalePreference) {
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not available in every supported browser
	document.cookie =
		preference === "system"
			? `${LOCALE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`
			: `${LOCALE_COOKIE}=${preference}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

/**
 * Language mode "System / Deutsch / English". The explicit choice lives in a cookie so the
 * server renders the right language without a locale prefix in URLs.
 */
export function LocalePreferenceProvider({ initialPreference, children }: { initialPreference: LocalePreference; children: ReactNode }) {
	const router = useRouter();
	const [preference, setPreferenceState] = useState(initialPreference);
	const [pending, startTransition] = useTransition();

	const setPreference = useCallback(
		(next: LocalePreference) => {
			setPreferenceState(next);
			writeCookie(next);
			startTransition(() => router.refresh());
		},
		[router],
	);

	const value = useMemo(() => ({ preference, setPreference, pending }), [preference, setPreference, pending]);

	return <LocalePreferenceContext.Provider value={value}>{children}</LocalePreferenceContext.Provider>;
}

export function useLocalePreference(): LocalePreferenceContextValue {
	const context = useContext(LocalePreferenceContext);
	if (!context) {
		throw new Error("useLocalePreference must be used within LocalePreferenceProvider");
	}
	return context;
}
