import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("resetPassword");
	return { title: t("pageTitle") };
}

/** Reached from the link in a password reset e-mail: `/reset-password#token=…`. */
export default function Page() {
	return <ResetPasswordForm />;
}
