import { type Locale, parseUserAgent } from "@aegis/contracts";
import { formatDateTime } from "../format";
import type { EmailMessages } from "../messages/index";

/** Where a request came from, as far as Aegis can tell. */
export interface RequestOrigin {
	ipAddress: string | null;
	userAgent: string | null;
}

/** "Firefox on Windows", or as much of it as the User-Agent reveals. */
function deviceLabel(userAgent: string | null, messages: EmailMessages): string {
	const { browser, os } = parseUserAgent(userAgent);
	if (browser && os) {
		return messages.common.deviceOn(browser, os);
	}
	return browser ?? os ?? messages.common.unknown;
}

/**
 * The rows that let a recipient recognise their own request — or spot that it was not theirs.
 * Shown on every message that was triggered by someone at a keyboard.
 */
export function originFacts(
	{ at, origin, label }: { at: Date; origin: RequestOrigin; label: string },
	messages: EmailMessages,
	locale: Locale,
): { label: string; value: string }[] {
	return [
		{ label, value: formatDateTime(at, locale) },
		{ label: messages.fields.ipAddress, value: origin.ipAddress ?? messages.common.unknown },
		{ label: messages.fields.device, value: deviceLabel(origin.userAgent, messages) },
	];
}
