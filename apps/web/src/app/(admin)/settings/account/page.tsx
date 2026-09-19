import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AccountSettings } from "@/components/settings/account-settings";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("settings");
	return { title: t("tabs.account") };
}

export default function Page() {
	return <AccountSettings />;
}
