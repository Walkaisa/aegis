import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserOverview } from "@/components/users/user-overview";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("userDetail");
	return { title: t("tabs.overview") };
}

export default function Page() {
	return <UserOverview />;
}
