import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("forgotPassword");
	return { title: t("pageTitle") };
}

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const { challenge } = await searchParams;
	return <ForgotPasswordForm challenge={typeof challenge === "string" ? challenge : null} />;
}
