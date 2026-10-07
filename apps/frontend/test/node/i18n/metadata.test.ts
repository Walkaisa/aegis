import { describe, expect, it } from "vitest";
import { localeOf, pageTitle } from "@/i18n/metadata";
import { localeProps } from "../../support/export";

describe("localeOf", () => {
	it("reads the locale of the route and falls back to the default one", async () => {
		expect(await localeOf(localeProps("de"))).toBe("de");
		expect(await localeOf(localeProps("en"))).toBe("en");
		expect(await localeOf(localeProps("xx"))).toBe("en");
	});
});

describe("pageTitle", () => {
	it("titles a page with a message in the language of the route", async () => {
		const metadata = pageTitle("users", "title");

		expect(await metadata(localeProps("en"))).toEqual({ title: "Users" });
		expect(await metadata(localeProps("de"))).toEqual({ title: "Benutzer" });
	});
});
