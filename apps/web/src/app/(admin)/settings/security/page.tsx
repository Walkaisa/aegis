import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SecuritySettings } from "@/components/settings/security-settings";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("settings");
	return { title: t("tabs.security") };
}

export default function Page() {
	return <SecuritySettings />;
}
