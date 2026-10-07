import { UserOverview } from "@/components/users/user-overview";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("userDetail", "tabs.overview");

export default function Page() {
	return <UserOverview />;
}
