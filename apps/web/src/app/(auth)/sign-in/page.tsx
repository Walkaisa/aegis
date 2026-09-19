import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthRequestFlow } from "@/components/auth/auth-request-flow";
import { SignInForm } from "@/components/auth/sign-in-form";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("signIn");
	return { title: t("pageTitle") };
}

/**
 * Two sign-in situations share this page:
 * - `?challenge=` – an application started an authorization request (accounts with access to it),
 * - otherwise – sign-in to the administration UI (accounts with `console:access`).
 */
export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const { challenge } = await searchParams;
	return typeof challenge === "string" ? <AuthRequestFlow challenge={challenge} /> : <SignInForm />;
}
