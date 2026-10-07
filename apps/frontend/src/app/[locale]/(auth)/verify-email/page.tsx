import { VerifyEmailCard } from "@/components/auth/verify-email-card";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("verifyEmail", "pageTitle");

/** Reached from the link sent to a new e-mail address: `/verify-email#token=…`. */
export default function Page() {
	return <VerifyEmailCard />;
}
