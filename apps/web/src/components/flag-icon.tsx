import type { Locale } from "@aegis/contracts";
import type { ReactElement } from "react";
import { cn } from "@/lib/utils";

export type FlagCountry = "gb" | "de";

const FLAGS: Record<FlagCountry, ReactElement> = {
	gb: (
		<>
			<path fill="#012169" d="M0 0h640v480H0z" />
			<path fill="#FFF" d="m75 0 244 181L562 0h78v62L400 241l240 178v61h-80L320 301 81 480H0v-60l239-178L0 84V0h75z" />
			<path
				fill="#C8102E"
				d="m424 281 216 159v40L369 281h55zm-184 20 6 35L54 480H0l240-179zM640 0v3L391 191l2-44L590 0h50zM0 0l239 176h-60L0 42V0z"
			/>
			<path fill="#FFF" d="M241 0v480h160V0H241zM0 160v160h640V160H0z" />
			<path fill="#C8102E" d="M0 193v96h640v-96H0zM273 0v480h96V0h-96z" />
		</>
	),
	de: (
		<>
			<path fill="#FFCE00" d="M0 320h640v160H0z" />
			<path fill="#000" d="M0 0h640v160H0z" />
			<path fill="#D00" d="M0 160h640v160H0z" />
		</>
	),
};

/** Native names and flags of the supported UI languages. */
export const LOCALE_OPTIONS: Record<Locale, { label: string; flag: FlagCountry }> = {
	de: { label: "Deutsch", flag: "de" },
	en: { label: "English", flag: "gb" },
};

export function FlagIcon({ country, className }: { country: FlagCountry; className?: string }) {
	return (
		<svg
			viewBox="0 0 640 480"
			aria-hidden="true"
			focusable="false"
			className={cn("inline-block h-3 w-4 shrink-0 overflow-hidden rounded-[2px] ring-1 ring-black/10", className)}
		>
			{FLAGS[country]}
		</svg>
	);
}
