import { SUPPORTED_LOCALES } from "@aegis/contracts";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { LocalePreferenceProvider } from "@/components/locale-preference";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type LocaleProps, localeOf } from "@/i18n/metadata";
import { BRAND_COLOR, BRAND_ICONS } from "@/lib/brand";
import { cn } from "@/lib/utils";
import "../globals.css";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

/** Every page is exported once per locale; the backend serves the one the visitor prefers. */
export function generateStaticParams() {
	return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const dynamicParams = false;

export const viewport: Viewport = {
	themeColor: BRAND_COLOR,
};

export async function generateMetadata(props: LocaleProps): Promise<Metadata> {
	const t = await getTranslations({ locale: await localeOf(props), namespace: "meta" });
	return {
		title: { default: "Aegis", template: "%s · Aegis" },
		description: t("description"),
		applicationName: "Aegis",
		appleWebApp: { capable: true, title: "Aegis", statusBarStyle: "default" },
		robots: { index: false, follow: false },
		icons: {
			// Browsers pick the first format they understand; the SVG scales to every tab size.
			icon: [
				{ url: BRAND_ICONS.svg, type: "image/svg+xml", sizes: "any" },
				{ url: BRAND_ICONS.png, type: "image/png", sizes: "96x96" },
				{ url: BRAND_ICONS.favicon, sizes: "16x16 32x32 48x48" },
			],
			apple: [{ url: BRAND_ICONS.appleTouch, type: "image/png", sizes: "180x180" }],
			other: [{ rel: "mask-icon", url: BRAND_ICONS.safariPinnedTab, color: BRAND_COLOR }],
		},
	};
}

export default async function RootLayout({ children, ...props }: LocaleProps & { children: ReactNode }) {
	const locale = await localeOf(props);

	return (
		<html lang={locale} suppressHydrationWarning className={cn(geistSans.variable, geistMono.variable)}>
			<body className="min-h-svh bg-background font-sans antialiased">
				<NextIntlClientProvider>
					<LocalePreferenceProvider>
						<ThemeProvider>
							<TooltipProvider>
								{children}
								<Toaster position="top-center" />
							</TooltipProvider>
						</ThemeProvider>
					</LocalePreferenceProvider>
				</NextIntlClientProvider>
			</body>
		</html>
	);
}
