import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GeneralSettings } from "@/components/settings/general-settings";
import { VersionSettings } from "@/components/settings/version-settings";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("settings");
	return { title: t("title") };
}

export default function Page() {
	return (
		<>
			<GeneralSettings />
			<VersionSettings />
		</>
	);
}
