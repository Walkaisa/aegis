import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LocalePreferenceProvider, preferenceCookie, useLocalePreference } from "@/components/locale-preference";

function Preference() {
	return <output>{useLocalePreference().preference}</output>;
}

describe("LocalePreferenceProvider", () => {
	it("assumes the browser's language while pages are exported", () => {
		const html = renderToString(
			<LocalePreferenceProvider>
				<Preference />
			</LocalePreferenceProvider>,
		);

		expect(html).toBe("<output>system</output>");
	});
});

describe("preferenceCookie", () => {
	it("stores a language for a year and removes the cookie for the browser's language", () => {
		expect(preferenceCookie("de", false)).toBe("aegis_locale=de; Max-Age=31536000; Path=/; SameSite=Lax");
		expect(preferenceCookie("system", true)).toBe("aegis_locale=; Max-Age=0; Path=/; SameSite=Lax; Secure");
	});
});
