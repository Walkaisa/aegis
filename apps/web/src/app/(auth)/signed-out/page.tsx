import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("signedOut");
	return { title: t("title") };
}

/** Shown after an application ended the sign-in through the OIDC sign-out endpoint. */
export default async function SignedOutPage() {
	const t = await getTranslations("signedOut");
	return <AuthCard icon={<LogOut />} title={t("title")} description={t("description")} />;
}
