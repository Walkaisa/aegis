import { SetupForm } from "@/components/auth/setup-form";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("setup", "title");

export default function SetupPage() {
	return <SetupForm />;
}
