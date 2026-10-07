"use client";

import { isLocale, LOCALE_COOKIE, type Locale } from "@aegis/contracts";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import { reloadPage } from "@/lib/browser";

export type LocalePreference = Locale | "system";

interface LocalePreferenceContextValue {
	preference: LocalePreference;
	setPreference: (preference: LocalePreference) => void;
	pending: boolean;
}

const LocalePreferenceContext = createContext<LocalePreferenceContextValue | null>(null);

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

function readCookie(): LocalePreference {
	const prefix = `${LOCALE_COOKIE}=`;
	const value = document.cookie
		.split("; ")
		.find((entry) => entry.startsWith(prefix))
		?.slice(prefix.length);
	return isLocale(value) ? value : "system";
}

/** The `Set-Cookie` value storing a preference; "system" removes the cookie. `secure` on HTTPS deployments. */
export function preferenceCookie(preference: LocalePreference, secure: boolean): string {
	const attributes = `Path=/; SameSite=Lax${secure ? "; Secure" : ""}`;
	return preference === "system"
		? `${LOCALE_COOKIE}=; Max-Age=0; ${attributes}`
		: `${LOCALE_COOKIE}=${preference}; Max-Age=${ONE_YEAR_SECONDS}; ${attributes}`;
}

function writeCookie(preference: LocalePreference) {
	// biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is not available in every supported browser
	document.cookie = preferenceCookie(preference, window.location.protocol === "https:");
}

/** The cookie only changes through `setPreference`, which reloads the page. */
const subscribe = () => () => {};

/** Pages are prerendered without a request, so the stored choice is only known in the browser. */
const serverSnapshot = (): LocalePreference => "system";

/**
 * Language mode "System / Deutsch / English". The explicit choice lives in a cookie, from which
 * the backend picks the language every page is served in, so URLs carry no locale prefix. Each
 * page is exported once per language, which is why a new choice reloads the page.
 */
export function LocalePreferenceProvider({ children }: { children: ReactNode }) {
	const stored = useSyncExternalStore(subscribe, readCookie, serverSnapshot);
	const [requested, setRequested] = useState<LocalePreference | null>(null);
	const preference = requested ?? stored;

	const setPreference = useCallback(
		(next: LocalePreference) => {
			if (next === preference) {
				return;
			}
			setRequested(next);
			writeCookie(next);
			reloadPage();
		},
		[preference],
	);

	const value = useMemo(() => ({ preference, setPreference, pending: requested !== null }), [preference, setPreference, requested]);

	return <LocalePreferenceContext.Provider value={value}>{children}</LocalePreferenceContext.Provider>;
}

export function useLocalePreference(): LocalePreferenceContextValue {
	const context = useContext(LocalePreferenceContext);
	if (!context) {
		throw new Error("useLocalePreference must be used within LocalePreferenceProvider");
	}
	return context;
}
