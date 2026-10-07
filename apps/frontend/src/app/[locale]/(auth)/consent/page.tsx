import { Suspense } from "react";
import { AuthRequestFlow, AuthRequestLoading } from "@/components/auth/auth-request-flow";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("authRequest", "consentPageTitle");

export default function ConsentPage() {
	return (
		<Suspense fallback={<AuthRequestLoading />}>
			<AuthRequestFlow />
		</Suspense>
	);
}
