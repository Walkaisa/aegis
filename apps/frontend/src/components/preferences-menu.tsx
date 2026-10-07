"use client";

import { SUPPORTED_LOCALES } from "@aegis/contracts";
import { Languages, SunMoon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { FlagIcon, LOCALE_OPTIONS } from "@/components/flag-icon";
import { type LocalePreference, useLocalePreference } from "@/components/locale-preference";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageMenu() {
	const t = useTranslations("preferences");
	const { preference, setPreference } = useLocalePreference();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label={t("language")}>
					<Languages />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel>{t("language")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value={preference} onValueChange={(value) => setPreference(value as LocalePreference)}>
					<DropdownMenuRadioItem value="system">{t("system")}</DropdownMenuRadioItem>
					{SUPPORTED_LOCALES.map((code) => (
						<DropdownMenuRadioItem key={code} value={code} lang={code}>
							<FlagIcon country={LOCALE_OPTIONS[code].flag} />
							{LOCALE_OPTIONS[code].label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function ThemeMenu() {
	const t = useTranslations("preferences");
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="ghost" size="icon" aria-label={t("theme")}>
					<SunMoon />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				<DropdownMenuLabel>{t("theme")}</DropdownMenuLabel>
				<DropdownMenuSeparator />
				<DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
					<DropdownMenuRadioItem value="system">{t("system")}</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="light">{t("light")}</DropdownMenuRadioItem>
					<DropdownMenuRadioItem value="dark">{t("dark")}</DropdownMenuRadioItem>
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export function PreferencesMenu() {
	return (
		<div className="flex items-center gap-1">
			<LanguageMenu />
			<ThemeMenu />
		</div>
	);
}
