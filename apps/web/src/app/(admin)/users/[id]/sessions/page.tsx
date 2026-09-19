import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { UserSessions } from "@/components/users/user-sessions";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("userDetail");
	return { title: t("tabs.sessions") };
}

export default function Page() {
	return <UserSessions />;
}
