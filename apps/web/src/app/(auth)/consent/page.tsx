import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthRequestFlow } from "@/components/auth/auth-request-flow";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("authRequest");
	return { title: t("consentPageTitle") };
}

export default async function ConsentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const { challenge } = await searchParams;
	return <AuthRequestFlow challenge={typeof challenge === "string" ? challenge : null} />;
}
