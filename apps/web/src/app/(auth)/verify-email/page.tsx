import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VerifyEmailCard } from "@/components/auth/verify-email-card";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("verifyEmail");
	return { title: t("pageTitle") };
}

/** Reached from the link sent to a new e-mail address: `/verify-email#token=…`. */
export default function Page() {
	return <VerifyEmailCard />;
}
