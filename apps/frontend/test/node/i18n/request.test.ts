import type { Locale } from "@aegis/contracts";
import { locale as routeLocale } from "next/root-params";
import { describe, expect, it, vi } from "vitest";
import requestConfig from "@/i18n/request";
import { MESSAGES } from "../../support/messages";

// Next.js replaces the module while it builds the pages; outside of it there is no route to read from.
vi.mock("next/root-params", () => ({ locale: vi.fn() }));

const configFor = (explicit?: Locale) => requestConfig({ locale: explicit, requestLocale: Promise.resolve(undefined) });

describe("request config", () => {
	it("provides the messages of the locale in the route", async () => {
		vi.mocked(routeLocale).mockResolvedValue("de");

		expect(await configFor()).toEqual({ locale: "de", messages: MESSAGES.de });
	});

	it("prefers a locale passed explicitly", async () => {
		vi.mocked(routeLocale).mockResolvedValue("de");

		expect(await configFor("en")).toEqual({ locale: "en", messages: MESSAGES.en });
		expect(routeLocale).not.toHaveBeenCalled();
	});

	it("falls back to the default locale for a route it does not know", async () => {
		vi.mocked(routeLocale).mockResolvedValue("xx");

		expect(await configFor()).toEqual({ locale: "en", messages: MESSAGES.en });
	});
});
