import { NewUserPage } from "@/components/users/new-user-page";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("newUser", "title");

export default function Page() {
	return <NewUserPage />;
}
