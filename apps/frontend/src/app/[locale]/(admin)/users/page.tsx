import { UsersPage } from "@/components/users/users-page";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("users", "title");

export default function Page() {
	return <UsersPage />;
}
