import { GeneralSettings } from "@/components/settings/general-settings";
import { VersionSettings } from "@/components/settings/version-settings";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("settings", "title");

export default function Page() {
	return (
		<>
			<GeneralSettings />
			<VersionSettings />
		</>
	);
}
