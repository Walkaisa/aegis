import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("resetPassword", "pageTitle");

/** Reached from the link in a password reset e-mail: `/reset-password#token=…`. */
export default function Page() {
	return <ResetPasswordForm />;
}
