import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SetupForm } from "@/components/auth/setup-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("setup");
	return { title: t("title") };
}

export default function SetupPage() {
	return <SetupForm />;
}
