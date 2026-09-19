import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserApplications } from "@/components/users/user-applications";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("userDetail");
	return { title: t("tabs.applications") };
}

export default function Page() {
	return <UserApplications />;
}
