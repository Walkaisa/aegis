import { Suspense } from "react";
import { AuthRequestFlow, AuthRequestLoading } from "@/components/auth/auth-request-flow";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("signIn", "pageTitle");

/**
 * Sign-in for an application (accounts with access to it). The backend serves this page for
 * `/sign-in?challenge=`, the URL oidc-provider leads to; it has no URL of its own.
 */
export default function ApplicationSignInPage() {
	return (
		<Suspense fallback={<AuthRequestLoading />}>
			<AuthRequestFlow />
		</Suspense>
	);
}
