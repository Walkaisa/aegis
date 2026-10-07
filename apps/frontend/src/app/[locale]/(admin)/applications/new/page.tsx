import { Suspense } from "react";
import { NewApplicationPage } from "@/components/applications/new-application-page";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("newApplication", "title");

export default function Page() {
	return (
		<Suspense>
			<NewApplicationPage />
		</Suspense>
	);
}
