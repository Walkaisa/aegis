"use client";

import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
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

/** An authorization request that cannot continue: `/error?error=…&error_description=…`, set by oidc-provider. */
export function OidcError() {
	const t = useTranslations("oidcError");
	const params = useSearchParams();
	const error = params.get("error")?.slice(0, 100) ?? "server_error";
	const description = params.get("error_description")?.slice(0, 500) ?? null;
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
