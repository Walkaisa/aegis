import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplicationQuickstart } from "@/components/applications/application-quickstart";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("applicationDetail");
	return { title: t("tabs.quickstart") };
}

export default function Page() {
	return <ApplicationQuickstart />;
}
