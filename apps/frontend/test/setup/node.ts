import type { Locale } from "@aegis/contracts";
import type { AbstractIntlMessages } from "next-intl";
import { vi } from "vitest";

// Only a Next.js build turns these calls into self-hosted fonts; here they return a class name like the generated one.
vi.mock("next/font/google", () => ({
	Geist: () => ({ variable: "__variable_geist_sans" }),
	Geist_Mono: () => ({ variable: "__variable_geist_mono" }),
}));

// `next-intl/server` reads its configuration through React Server Components, which only Next.js'
// renderer provides; outside of it the package throws on purpose. The same translations stand in.
vi.mock("next-intl/server", async () => {
	const { createTranslator } = await import("next-intl");
	const { MESSAGES } = await import("../support/messages");
	return {
		getRequestConfig: <T>(create: T) => create,
		getTranslations: async ({ locale, namespace }: { locale: Locale; namespace: string }) => {
			const messages: AbstractIntlMessages = MESSAGES[locale];
			return createTranslator({ locale, messages, namespace });
		},
	};
});
