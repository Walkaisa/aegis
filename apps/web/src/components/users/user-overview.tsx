"use client";

import type { AuditPageResponse, SessionApplicationDto, SessionListResponse } from "@aegis/contracts";
import { ArrowRight, History } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AppAvatar } from "@/components/app-avatar";
import { EventList } from "@/components/dashboard/event-list";
import { DetailRow, DetailsCard, Section } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/users/user-layout";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDateFormat } from "@/lib/format";

const RECENT_EVENTS = 8;

/** The overview tab of an account: key facts, its latest activity and where it is signed in. */
export function UserOverview() {
	const t = useTranslations("userDetail");
	const tRoles = useTranslations("roles");
	const dates = useDateFormat();
	const { user } = useUser();

	const activity = useApiQuery<AuditPageResponse>(
		`/audit/events?${new URLSearchParams({ search: user.email, perPage: String(RECENT_EVENTS) })}`,
	);

	return (
		<div className="flex flex-col gap-6">
			<div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
				<Section
					title={t("activity")}
					description={t("activityDescription")}
					action={
						<Button asChild variant="ghost" size="sm">
							<Link href="/audit">
								{t("viewAudit")}
								<ArrowRight />
							</Link>
						</Button>
					}
				>
					{activity.error ? (
						<ErrorState error={activity.error} onRetry={() => void activity.reload()} />
					) : !activity.data ? (
						<LoadingState rows={4} className="h-14" />
					) : activity.data.events.length === 0 ? (
						<div className="flex flex-col items-center gap-3 py-8 text-center">
							<span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
								<History className="size-5" />
							</span>
							<p className="text-sm text-muted-foreground">{t("noActivity")}</p>
						</div>
					) : (
						<EventList events={activity.data.events} />
					)}
				</Section>

				<aside className="flex flex-col gap-6">
					<DetailsCard title={t("details")}>
						<DetailRow label={t("detailLabels.role")}>{tRoles(user.role)}</DetailRow>
						<DetailRow label={t("detailLabels.email")}>{user.email}</DetailRow>
						<DetailRow label={t("detailLabels.emailVerified")}>{user.emailVerified ? t("yes") : t("no")}</DetailRow>
						<DetailRow label={t("detailLabels.twoFactor")}>
							{user.twoFactorEnabled ? t("twoFactor.enabled") : t("twoFactor.disabled")}
						</DetailRow>
						<DetailRow label={t("detailLabels.createdAt")}>{dates.date(user.createdAt)}</DetailRow>
						<DetailRow label={t("detailLabels.updatedAt")}>{dates.relative(user.updatedAt)}</DetailRow>
					</DetailsCard>
					<SignedInApplications />
				</aside>
			</div>
		</div>
	);
}

/** Applications the account is currently signed in to, collected from its active sessions. */
function SignedInApplications() {
	const t = useTranslations("userDetail");
	const dates = useDateFormat();
	const { path } = useUser();
	const { data, error, reload } = useApiQuery<SessionListResponse>(`${path}/sessions`);

	const applications = useMemo(() => {
		const byId = new Map<string, SessionApplicationDto>();
		for (const session of data?.sessions ?? []) {
			for (const application of session.applications) {
				const known = byId.get(application.id);
				if (!known || known.lastAuthorizedAt < application.lastAuthorizedAt) {
					byId.set(application.id, application);
				}
			}
		}
		return [...byId.values()].sort((a, b) => b.lastAuthorizedAt.localeCompare(a.lastAuthorizedAt));
	}, [data]);

	return (
		<Section title={t("applications")}>
			{error ? (
				<ErrorState error={error} onRetry={() => void reload()} />
			) : !data ? (
				<LoadingState rows={2} className="h-10" />
			) : applications.length === 0 ? (
				<p className="text-sm text-muted-foreground">{t("noApplications")}</p>
			) : (
				<ul className="-mx-2 flex flex-col gap-0.5">
					{applications.map((application) => (
						<li key={application.id}>
							<Link
								href={`/applications/${application.id}`}
								className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
							>
								<AppAvatar name={application.name} src={application.logoUrl} size="sm" />
								<div className="flex min-w-0 flex-col">
									<span className="truncate text-sm font-medium">{application.name}</span>
									<span className="truncate text-xs text-muted-foreground">
										{dates.relative(application.lastAuthorizedAt)}
									</span>
								</div>
							</Link>
						</li>
					))}
				</ul>
			)}
		</Section>
	);
}
