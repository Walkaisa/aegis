import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, resolveLocale, SUPPORTED_LOCALES } from "../src/locale";

describe("isLocale", () => {
	it("accepts the supported locales only", () => {
		expect(SUPPORTED_LOCALES.every(isLocale)).toBe(true);
		expect(isLocale("fr")).toBe(false);
		expect(isLocale(undefined)).toBe(false);
	});
});

describe("resolveLocale", () => {
	it("prefers an explicit choice", () => {
		expect(resolveLocale("de", "en-US,en;q=0.9")).toBe("de");
	});

	it("follows the browser's ranking otherwise", () => {
		expect(resolveLocale(undefined, "fr-FR, de-DE;q=0.8, en;q=0.9")).toBe("en");
		expect(resolveLocale("xx", "de-AT")).toBe("de");
		expect(resolveLocale(null, "fr, de;q=0.5, en;q=0.5")).toBe("de");
		expect(resolveLocale(null, "EN-gb")).toBe("en");
	});

	it("skips unusable entries and falls back to the default", () => {
		expect(resolveLocale(null, "de;q=0, ;q=1, en;q=abc")).toBe(DEFAULT_LOCALE);
		expect(resolveLocale(null, "fr, it")).toBe(DEFAULT_LOCALE);
		expect(resolveLocale(null, "")).toBe(DEFAULT_LOCALE);
		expect(resolveLocale(undefined, undefined)).toBe(DEFAULT_LOCALE);
	});

	it("takes linear time on hostile headers", () => {
		const started = performance.now();
		expect(resolveLocale(null, `${"-".repeat(100_000)}\n`)).toBe(DEFAULT_LOCALE);
		expect(resolveLocale(null, `${";".repeat(100_000)}\n`)).toBe(DEFAULT_LOCALE);
		expect(performance.now() - started).toBeLessThan(1_000);
	});
});
