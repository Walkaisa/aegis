import { TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";

const KNOWN_ERRORS = new Set([
	"invalid_request",
	"invalid_client",
	"invalid_redirect_uri",
	"unauthorized_client",
	"unsupported_response_type",
	"invalid_scope",
	"access_denied",
	"login_required",
	"consent_required",
	"interaction_required",
	"invalid_grant",
	"server_error",
]);

export async function generateMetadata(): Promise<Metadata> {
	const t = await getTranslations("oidcError");
	return { title: t("pageTitle") };
}

export default async function OidcErrorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
	const params = await searchParams;
	const t = await getTranslations("oidcError");
	const error = typeof params.error === "string" ? params.error.slice(0, 100) : "server_error";
	const description = typeof params.error_description === "string" ? params.error_description.slice(0, 500) : null;
	const key = KNOWN_ERRORS.has(error) ? error : "default";

	return (
		<AuthCard icon={<TriangleAlert />} title={t(`${key}.title`)} description={t(`${key}.description`)} footer={t("footer")}>
			<div className="flex flex-col gap-4">
				<details className="rounded-lg border bg-muted/40 p-3 text-xs">
					<summary className="cursor-pointer font-medium select-none">{t("details")}</summary>
					<dl className="mt-3 grid gap-2 font-mono break-all">
						<div>
							<dt className="text-muted-foreground">error</dt>
							<dd>{error}</dd>
						</div>
						{description ? (
							<div>
								<dt className="text-muted-foreground">error_description</dt>
								<dd>{description}</dd>
							</div>
						) : null}
					</dl>
				</details>
				<Button asChild variant="outline" className="w-full">
					<Link href="/">{t("home")}</Link>
				</Button>
			</div>
		</AuthCard>
	);
}
