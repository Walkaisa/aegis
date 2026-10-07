import { OverviewPage } from "@/components/overview/overview-page";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("overview", "title");

export default function DashboardPage() {
	return <OverviewPage />;
}
