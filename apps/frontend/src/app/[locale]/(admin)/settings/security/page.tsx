import { SecuritySettings } from "@/components/settings/security-settings";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("settings", "tabs.security");

export default function Page() {
	return <SecuritySettings />;
}
