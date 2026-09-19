import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewApplicationPage } from "@/components/applications/new-application-page";
import { isApplicationKind } from "@/lib/applications";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("newApplication");
	return { title: t("title") };
}

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
	const { kind } = await searchParams;
	return <NewApplicationPage initialKind={isApplicationKind(kind) ? kind : "web"} />;
}
