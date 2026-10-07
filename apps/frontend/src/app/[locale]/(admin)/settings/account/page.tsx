import { AccountSettings } from "@/components/settings/account-settings";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("settings", "tabs.account");

export default function Page() {
	return <AccountSettings />;
}
