import { ApplicationSettings } from "@/components/applications/application-settings";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("applicationDetail", "tabs.settings");

export default function Page() {
	return <ApplicationSettings />;
}
