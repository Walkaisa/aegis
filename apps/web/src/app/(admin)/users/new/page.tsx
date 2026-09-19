import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewUserPage } from "@/components/users/new-user-page";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("newUser");
	return { title: t("title") };
}

export default function Page() {
	return <NewUserPage />;
}
