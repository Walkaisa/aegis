import { Suspense } from "react";
import { AuthPending } from "@/components/auth/auth-card";
import { OidcError } from "@/components/auth/oidc-error";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("oidcError", "pageTitle");

export default function OidcErrorPage() {
	return (
		<Suspense fallback={<AuthPending />}>
			<OidcError />
		</Suspense>
	);
}
