import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand";
import { PreferencesMenu } from "@/components/preferences-menu";

export default async function AuthLayout({ children }: { children: ReactNode }) {
	const t = await getTranslations("common");

	return (
		<div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background">
			<div aria-hidden="true" className="auth-grid pointer-events-none absolute inset-0 -z-10" />
			<div aria-hidden="true" className="auth-glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[36rem]" />
			<header className="flex items-center justify-end p-3 sm:p-4">
				<PreferencesMenu />
			</header>
			<main className="flex flex-1 items-start justify-center px-4 pt-2 pb-10 sm:items-center sm:pt-0">
				<div className="w-full">{children}</div>
			</main>
			<footer className="flex items-center justify-center gap-1.5 px-4 pb-6 text-xs text-muted-foreground">
				<BrandMark size="xs" />
				{t("securedBy")}
			</footer>
		</div>
	);
}
