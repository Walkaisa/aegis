import { SignInForm } from "@/components/auth/sign-in-form";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("signIn", "pageTitle");

/**
 * Sign-in to the administration UI (accounts with `console:access`). A sign-in for an application
 * shares the URL, `/sign-in?challenge=`, but is served from `sign-in/application`.
 */
export default function SignInPage() {
	return <SignInForm />;
}
