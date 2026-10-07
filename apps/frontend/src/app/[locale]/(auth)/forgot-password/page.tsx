import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("forgotPassword", "pageTitle");

export default function Page() {
	return <ForgotPasswordForm />;
}
