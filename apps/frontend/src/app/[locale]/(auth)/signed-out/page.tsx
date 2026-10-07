import { LogOut } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { type LocaleProps, localeOf, pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("signedOut", "title");

/** Shown after an application ended the sign-in through the OIDC sign-out endpoint. */
export default async function SignedOutPage(props: LocaleProps) {
	const t = await getTranslations({ locale: await localeOf(props), namespace: "signedOut" });
	return <AuthCard icon={<LogOut />} title={t("title")} description={t("description")} />;
}
