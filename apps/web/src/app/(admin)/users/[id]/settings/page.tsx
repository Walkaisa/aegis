import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserSettings } from "@/components/users/user-settings";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("userDetail");
	return { title: t("tabs.settings") };
}

export default function Page() {
	return <UserSettings />;
}
