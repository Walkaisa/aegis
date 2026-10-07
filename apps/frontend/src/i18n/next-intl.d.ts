import type { Locale } from "@aegis/contracts";

/** Types `useLocale()` and friends with the languages Aegis is exported in. */
declare module "next-intl" {
	interface AppConfig {
		Locale: Locale;
	}
}
