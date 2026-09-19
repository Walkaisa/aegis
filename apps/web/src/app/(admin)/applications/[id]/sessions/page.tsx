import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplicationSessions } from "@/components/applications/client-sessions";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("applicationDetail");
	return { title: t("tabs.sessions") };
}

export default function Page() {
	return <ApplicationSessions />;
}
