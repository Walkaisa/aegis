import { UserSessions } from "@/components/users/user-sessions";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("userDetail", "tabs.sessions");

export default function Page() {
	return <UserSessions />;
}
