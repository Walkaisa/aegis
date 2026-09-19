import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplicationSettings } from "@/components/applications/application-settings";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("applicationDetail");
	return { title: t("tabs.settings") };
}

export default function Page() {
	return <ApplicationSettings />;
}
