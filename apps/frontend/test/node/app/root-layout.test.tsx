import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";
import RootLayout, { dynamicParams, generateMetadata, generateStaticParams, viewport } from "@/app/[locale]/layout";
import { BRAND_COLOR } from "@/lib/brand";
import { localeProps } from "../../support/export";
import { MESSAGES } from "../../support/messages";

describe("root layout", () => {
	it("exports every page once per supported locale and nothing else", () => {
		expect(generateStaticParams()).toEqual([{ locale: "de" }, { locale: "en" }]);
		expect(dynamicParams).toBe(false);
		expect(viewport).toEqual({ themeColor: BRAND_COLOR });
	});

	it("describes the pages in their language and keeps them out of search indexes", async () => {
		const en = await generateMetadata(localeProps("en"));
		const de = await generateMetadata(localeProps("de"));

		expect(en).toMatchObject({ title: { default: "Aegis", template: "%s · Aegis" }, robots: { index: false, follow: false } });
		expect(en.description).toBe(MESSAGES.en.meta.description);
		expect(de.description).toBe(MESSAGES.de.meta.description);
	});

	it("declares the language of the document", async () => {
		const html = (await RootLayout({ children: <main />, ...localeProps("de") })) as ReactElement<{ lang: string; className: string }>;

		expect(html.type).toBe("html");
		expect(html.props.lang).toBe("de");
		expect(html.props.className).toBe("__variable_geist_sans __variable_geist_mono");
	});
});
