import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplicationAccess } from "@/components/applications/application-access";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("applicationDetail");
	return { title: t("tabs.access") };
}

export default function Page() {
	return <ApplicationAccess />;
}
