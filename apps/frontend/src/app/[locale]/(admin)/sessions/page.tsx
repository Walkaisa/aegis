import { SessionsPage } from "@/components/sessions/sessions-page";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("sessions", "title");

export default function Page() {
	return <SessionsPage />;
}
