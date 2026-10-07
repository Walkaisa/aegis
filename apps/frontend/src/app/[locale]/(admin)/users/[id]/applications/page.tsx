import { UserApplications } from "@/components/users/user-applications";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("userDetail", "tabs.applications");

export default function Page() {
	return <UserApplications />;
}
