import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ApplicationsPage } from "@/components/applications/applications-page";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("applications");
	return { title: t("title") };
}

export default function Page() {
	return <ApplicationsPage />;
}
