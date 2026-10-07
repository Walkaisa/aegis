import { ApplicationSessions } from "@/components/applications/client-sessions";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("applicationDetail", "tabs.sessions");

export default function Page() {
	return <ApplicationSessions />;
}
