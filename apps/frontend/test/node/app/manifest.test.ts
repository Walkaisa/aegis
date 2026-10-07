import { describe, expect, it } from "vitest";
import manifest, { dynamic } from "@/app/manifest";
import { BRAND_COLOR, BRAND_ICONS } from "@/lib/brand";

describe("manifest", () => {
	it("describes Aegis as an installable app in the brand colour", () => {
		const result = manifest();

		expect(dynamic).toBe("force-static");
		expect(result).toMatchObject({ name: "Aegis", start_url: "/", display: "standalone", theme_color: BRAND_COLOR });
		expect(result.icons?.map((icon) => `${icon.src} ${icon.purpose}`)).toEqual([
			`${BRAND_ICONS.maskable192} any`,
			`${BRAND_ICONS.maskable512} any`,
			`${BRAND_ICONS.maskable192} maskable`,
			`${BRAND_ICONS.maskable512} maskable`,
		]);
	});
});
