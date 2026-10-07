import { ApplicationAccess } from "@/components/applications/application-access";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("applicationDetail", "tabs.access");

export default function Page() {
	return <ApplicationAccess />;
}
