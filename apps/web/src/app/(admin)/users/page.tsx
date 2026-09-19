import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UsersPage } from "@/components/users/users-page";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("users");
	return { title: t("title") };
}

export default function Page() {
	return <UsersPage />;
}
