import { AuditPage } from "@/components/audit/audit-page";
import { pageTitle } from "@/i18n/metadata";

export const generateMetadata = pageTitle("audit", "title");

export default function Page() {
	return <AuditPage />;
}
