import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";
import { useLocalePreference } from "@/components/locale-preference";
import { PreferencesMenu, ThemeMenu } from "@/components/preferences-menu";
import { reloadPage } from "@/lib/browser";
import { MESSAGES, renderUi } from "../../support/render";

const t = MESSAGES.en;

describe("PreferencesMenu", () => {
	function Preference() {
		const { preference, pending } = useLocalePreference();
		return <output>{`${preference}${pending ? " pending" : ""}`}</output>;
	}

	it("stores a language and reloads the page in it", async () => {
		await renderUi(
			<>
				<PreferencesMenu />
				<Preference />
			</>,
		);
		await expect.element(page.getByRole("status")).toHaveTextContent("system");

		await page.getByRole("button", { name: t.preferences.language }).click();
		await page.getByRole("menuitemradio", { name: "Deutsch" }).click();

		expect(document.cookie).toContain("aegis_locale=de");
		expect(reloadPage).toHaveBeenCalledOnce();
		await expect.element(page.getByRole("status")).toHaveTextContent("de pending");
	});

	it("goes back to the language of the browser", async () => {
		// biome-ignore lint/suspicious/noDocumentCookie: sets up the stored preference
		document.cookie = "aegis_locale=en; Path=/";
		await renderUi(
			<>
				<PreferencesMenu />
				<Preference />
			</>,
		);
		await expect.element(page.getByRole("status")).toHaveTextContent("en");

		await page.getByRole("button", { name: t.preferences.language }).click();
		await page.getByRole("menuitemradio", { name: "English" }).click();
		expect(reloadPage).not.toHaveBeenCalled();

		await page.getByRole("button", { name: t.preferences.language }).click();
		await page.getByRole("menuitemradio", { name: t.preferences.system }).click();
		expect(document.cookie).not.toContain("aegis_locale");
		expect(reloadPage).toHaveBeenCalledOnce();
	});

	it("shows the system theme before the theme is known", async () => {
		await render(
			<NextIntlClientProvider locale="en" messages={MESSAGES.en}>
				<ThemeMenu />
			</NextIntlClientProvider>,
		);

		await page.getByRole("button", { name: t.preferences.theme }).click();
		await expect.element(page.getByRole("menuitemradio", { name: t.preferences.system })).toHaveAttribute("aria-checked", "true");
	});

	it("switches the theme", async () => {
		await renderUi(<PreferencesMenu />);

		await page.getByRole("button", { name: t.preferences.theme }).click();
		await page.getByRole("menuitemradio", { name: t.preferences.dark }).click();

		await expect.poll(() => document.documentElement.classList.contains("dark")).toBe(true);
		await page.getByRole("button", { name: t.preferences.theme }).click();
		await page.getByRole("menuitemradio", { name: t.preferences.light }).click();
		await expect.poll(() => document.documentElement.classList.contains("light")).toBe(true);
	});

	it("needs its provider", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await expect(render(<Preference />)).rejects.toThrow("useLocalePreference must be used within LocalePreferenceProvider");
		error.mockRestore();
	});
});
