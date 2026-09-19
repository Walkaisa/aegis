"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Page, PageHeader } from "@/components/dashboard/page";
import { TabNav } from "@/components/dashboard/tab-nav";

export function SettingsLayout({ children }: { children: ReactNode }) {
	const t = useTranslations("settings");

	return (
		<Page className="gap-6">
			<PageHeader title={t("title")} description={t("description")} />
			<TabNav
				label={t("title")}
				items={[
					{ href: "/settings", label: t("tabs.general") },
					{ href: "/settings/account", label: t("tabs.account") },
					{ href: "/settings/security", label: t("tabs.security") },
				]}
			/>
			<div className="flex max-w-3xl flex-col gap-6">{children}</div>
		</Page>
	);
}
