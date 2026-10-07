import type { AuthSessionResponse, Locale } from "@aegis/contracts";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { vi } from "vitest";
import { render } from "vitest-browser-react";
import { AccountProvider } from "@/components/dashboard/account-context";
import { BreadcrumbsProvider } from "@/components/dashboard/breadcrumbs";
import { LocalePreferenceProvider } from "@/components/locale-preference";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MESSAGES } from "./messages";

export { MESSAGES, translate } from "./messages";

export interface RenderOptions {
	locale?: Locale;
	/** The signed-in account for components of the administration (`useAccount`). */
	me?: AuthSessionResponse;
}

/**
 * Renders a component inside the providers of the root layout: translations, theme, tooltips,
 * toasts and the language preference, plus the signed-in account of the administration.
 */
export async function renderUi(ui: ReactNode, { locale = "en", me }: RenderOptions = {}) {
	const account = me ? { me, reload: vi.fn(async () => {}), update: vi.fn() } : null;
	const wrap = (content: ReactNode) => (
		<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
			<LocalePreferenceProvider>
				<ThemeProvider>
					<TooltipProvider>
						{account ? (
							<AccountProvider value={account}>
								<BreadcrumbsProvider>{content}</BreadcrumbsProvider>
							</AccountProvider>
						) : (
							content
						)}
						<Toaster position="top-center" />
					</TooltipProvider>
				</ThemeProvider>
			</LocalePreferenceProvider>
		</NextIntlClientProvider>
	);

	const screen = await render(wrap(ui));
	/** Renders new content inside the same providers. */
	const rerender = (next: ReactNode) => screen.rerender(wrap(next));
	return { ...screen, rerender, account };
}

/** Wraps a hook's component in the same providers, for `renderHook`. */
export function Providers({ children, locale = "en" }: { children: ReactNode; locale?: Locale }) {
	return (
		<NextIntlClientProvider locale={locale} messages={MESSAGES[locale]} timeZone="UTC">
			{children}
		</NextIntlClientProvider>
	);
}
