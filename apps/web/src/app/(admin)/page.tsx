import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { OverviewPage } from "@/components/overview/overview-page";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("overview");
	return { title: t("title") };
}

export default function DashboardPage() {
	return <OverviewPage />;
}
