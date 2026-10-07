import { EmailSettings } from "@/components/settings/email-settings";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("emailSettings", "title");

export default function Page() {
	return <EmailSettings />;
}
