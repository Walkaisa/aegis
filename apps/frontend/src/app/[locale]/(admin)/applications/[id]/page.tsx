import { ApplicationQuickstart } from "@/components/applications/application-quickstart";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("applicationDetail", "tabs.quickstart");

export default function Page() {
	return <ApplicationQuickstart />;
}
