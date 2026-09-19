import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SessionsPage } from "@/components/sessions/sessions-page";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("sessions");
	return { title: t("title") };
}

export default function Page() {
	return <SessionsPage />;
}
