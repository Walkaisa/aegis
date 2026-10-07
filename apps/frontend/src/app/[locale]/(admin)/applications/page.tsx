import { ApplicationsPage } from "@/components/applications/applications-page";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("applications", "title");

export default function Page() {
	return <ApplicationsPage />;
}
