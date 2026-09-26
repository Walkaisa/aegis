import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmailSettings } from "@/components/settings/email-settings";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("emailSettings");
	return { title: t("title") };
}

export default function Page() {
	return <EmailSettings />;
}
