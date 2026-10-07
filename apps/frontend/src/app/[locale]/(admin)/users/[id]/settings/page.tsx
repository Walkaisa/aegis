import { UserSettings } from "@/components/users/user-settings";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("userDetail", "tabs.settings");

export default function Page() {
	return <UserSettings />;
}
