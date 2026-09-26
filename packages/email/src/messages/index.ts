import { DEFAULT_LOCALE, type Locale } from "@aegis/contracts";
import { de } from "./de";
import { en } from "./en";
import type { EmailMessages } from "./types";

export type { EmailMessages } from "./types";

const MESSAGES: Record<Locale, EmailMessages> = { de, en };

export function messagesFor(locale: Locale): EmailMessages {
	return MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
}
