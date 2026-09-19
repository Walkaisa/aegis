"use client";

import type { UserApplicationDto, UserApplicationListResponse } from "@aegis/contracts";
import { CircleCheck, CircleSlash } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppAvatar } from "@/components/app-avatar";
import { SectionHeader } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn } from "@/components/data-table/types";
import { StatusMessage } from "@/components/status-message";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useUser } from "@/components/users/user-layout";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { api } from "@/lib/api";

/** The applications tab of an account: where it may sign in, with its assignments. */
export function UserApplications() {
	const t = useTranslations("userApplications");
	const errorMessage = useErrorMessage();
	const { user, path } = useUser();
	const { data, error, reload } = useApiQuery<UserApplicationListResponse>(`${path}/applications`);
	const [pending, setPending] = useState<string | null>(null);

	const setAssigned = useCallback(
		async (application: UserApplicationDto, assigned: boolean) => {
			setPending(application.id);
			const assignment = `/applications/${application.id}/users/${user.id}`;
			try {
				await (assigned ? api.put(assignment) : api.delete(assignment));
				toast.success(t(assigned ? "assignedToast" : "unassignedToast", { name: application.name }));
				await reload();
			} catch (cause) {
				toast.error(errorMessage(cause));
			} finally {
				setPending(null);
			}
		},
		[errorMessage, reload, t, user.id],
	);

	const assignment = useCallback(
		(application: UserApplicationDto) =>
			// Open applications need no assignment; an existing one can still be removed.
			application.accessPolicy === "everyone" && !application.assigned ? (
				<span className="text-sm text-muted-foreground">{t("notNeeded")}</span>
			) : (
				<Switch
					checked={application.assigned}
					disabled={pending === application.id}
					onCheckedChange={(checked) => void setAssigned(application, checked)}
					aria-label={t("assign", { name: application.name })}
				/>
			),
		[pending, setAssigned, t],
	);

	const columns = useMemo<DataTableColumn<UserApplicationDto>[]>(
		() => [
			{
				id: "application",
				header: t("columns.application"),
				locked: true,
				flexible: true,
				value: (application) => application.name,
				cell: (application) => (
					<div className="flex min-w-0 items-center gap-3">
						<AppAvatar name={application.name} src={application.logoUrl} size="sm" />
						<Link href={`/applications/${application.id}/access`} className="truncate font-medium hover:underline">
							{application.name}
						</Link>
					</div>
				),
			},
			{
				id: "policy",
				header: t("columns.policy"),
				value: (application) => application.accessPolicy,
				searchable: false,
				hideBelow: "md",
				cell: (application) => <Badge variant="outline">{t(`policies.${application.accessPolicy}`)}</Badge>,
			},
			{
				id: "signIn",
				header: t("columns.signIn"),
				value: (application) => application.canSignIn,
				searchable: false,
				cell: (application) => <SignInState allowed={application.canSignIn} />,
			},
			{
				id: "assigned",
				header: t("columns.assigned"),
				value: (application) => application.assigned,
				searchable: false,
				align: "end",
				width: "1%",
				cell: assignment,
			},
		],
		[t, assignment],
	);

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader title={t("title")} description={t("description", { name: user.displayName })} />
			{error ? (
				<ErrorState error={error} onRetry={() => void reload()} />
			) : (
				<div className="flex flex-col gap-3">
					{user.role === "admin" ? <StatusMessage tone="info">{t("adminNotice")}</StatusMessage> : null}
					<DataTable
						label={t("title")}
						columns={columns}
						data={data?.applications ?? []}
						getRowId={(application) => application.id}
						loading={!data}
						searchPlaceholder={t("searchPlaceholder")}
						emptyTitle={t("emptyTitle")}
						emptyDescription={t("emptyDescription")}
						defaultState={{ sort: { columnId: "application", direction: "asc" }, pageSize: 10 }}
						pageSizeOptions={[10, 25, 50]}
						renderCard={(application) => (
							<div className="flex min-w-0 items-center justify-between gap-3">
								<div className="flex min-w-0 flex-col gap-1">
									<Link href={`/applications/${application.id}/access`} className="truncate font-medium hover:underline">
										{application.name}
									</Link>
									<SignInState allowed={application.canSignIn} />
								</div>
								{assignment(application)}
							</div>
						)}
					/>
				</div>
			)}
		</div>
	);
}

function SignInState({ allowed }: { allowed: boolean }) {
	const t = useTranslations("userApplications");

	return allowed ? (
		<span className="inline-flex items-center gap-1.5 text-sm">
			<CircleCheck className="size-4 text-success" />
			{t("allowed")}
		</span>
	) : (
		<span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
			<CircleSlash className="size-4" />
			{t("denied")}
		</span>
	);
}
