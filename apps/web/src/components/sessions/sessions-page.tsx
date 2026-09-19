"use client";

import { ROLES, type SessionDto, type SessionListResponse } from "@aegis/contracts";
import { AppWindow } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { AppAvatar } from "@/components/app-avatar";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DeviceIcon, useDeviceLabel } from "@/components/dashboard/device";
import { Page, PageHeader } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn, DataTableFilter } from "@/components/data-table/types";
import { SecondFactorBadge } from "@/components/sessions/second-factor-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/users/account-badges";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";

/** Active sessions of all accounts; one session serves the administration and application sign-ins alike. */
export function SessionsPage() {
	const t = useTranslations("sessions");
	const tRoles = useTranslations("roles");
	const dates = useDateFormat();
	const deviceLabel = useDeviceLabel();
	const { data, error, reload } = useApiQuery<SessionListResponse>("/sessions");

	const revoke = useCallback(
		async (id: string, current: boolean) => {
			await api.delete(`/sessions/${id}`);
			if (current) {
				window.location.assign("/sign-in");
				return;
			}
			toast.success(t("revoked"));
			await reload();
		},
		[reload, t],
	);

	/** Ends every session, the own one included, which signs out of this browser like revoking it alone. */
	async function revokeAll() {
		await api.delete("/sessions");
		window.location.assign("/sign-in");
	}

	const columns = useMemo<DataTableColumn<SessionDto>[]>(
		() => [
			{
				id: "account",
				header: t("columns.account"),
				locked: true,
				flexible: true,
				value: (session) => `${session.account.displayName} ${session.account.email}`,
				cell: (session) => (
					<div className="flex min-w-0 items-center gap-3">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
							<DeviceIcon userAgent={session.userAgent} />
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="flex min-w-0 items-center gap-2">
								<Link href={`/users/${session.account.id}`} className="truncate font-medium hover:underline">
									{session.account.displayName}
								</Link>
								{session.current ? <Badge>{t("current")}</Badge> : null}
								{session.secondFactor ? <SecondFactorBadge /> : null}
							</span>
							<span className="truncate text-xs text-muted-foreground">{session.account.email}</span>
						</div>
					</div>
				),
			},
			{
				id: "role",
				header: t("columns.role"),
				value: (session) => session.account.role,
				searchable: false,
				hideBelow: "md",
				cell: (session) => <RoleBadge role={session.account.role} />,
			},
			{
				id: "device",
				header: t("columns.device"),
				value: (session) => deviceLabel(session.userAgent),
				hideBelow: "lg",
				cell: (session) => (
					<div className="flex min-w-0 flex-col">
						<span className="truncate text-sm">{deviceLabel(session.userAgent)}</span>
						{session.ipAddress ? (
							<span className="truncate font-mono text-xs text-muted-foreground">{session.ipAddress}</span>
						) : null}
					</div>
				),
			},
			{
				id: "applications",
				header: t("columns.applications"),
				value: (session) => session.applications.map((application) => application.name).join(" "),
				hideBelow: "xl",
				cell: (session) =>
					session.applications.length === 0 ? (
						<span className="text-xs text-muted-foreground">{t("noApplications")}</span>
					) : (
						<div className="flex flex-wrap items-center gap-1">
							{session.applications.map((application) => (
								<Badge key={application.id} variant="outline" asChild>
									<Link href={`/applications/${application.id}`} title={dates.dateTime(application.lastAuthorizedAt)}>
										{application.logoUrl ? (
											<AppAvatar
												name={application.name}
												src={application.logoUrl}
												size="xs"
												className="-ml-0.5 size-3.5"
											/>
										) : (
											<AppWindow />
										)}
										{application.name}
									</Link>
								</Badge>
							))}
						</div>
					),
			},
			{
				id: "lastSeenAt",
				header: t("columns.lastActive"),
				value: (session) => new Date(session.lastSeenAt),
				searchable: false,
				hideBelow: "md",
				cell: (session) => (
					<span className="text-sm text-muted-foreground" title={dates.dateTime(session.lastSeenAt)}>
						{dates.relative(session.lastSeenAt)}
					</span>
				),
			},
			{
				id: "authenticatedAt",
				header: t("columns.signedInAt"),
				value: (session) => new Date(session.authenticatedAt),
				searchable: false,
				hiddenByDefault: true,
				cell: (session) => <span className="text-sm text-muted-foreground">{dates.dateTime(session.authenticatedAt)}</span>,
			},
			{
				id: "expiresAt",
				header: t("columns.expiresAt"),
				value: (session) => new Date(session.expiresAt),
				searchable: false,
				hiddenByDefault: true,
				cell: (session) => <span className="text-sm text-muted-foreground">{dates.dateTime(session.expiresAt)}</span>,
			},
			{
				id: "actions",
				header: <span className="sr-only">{t("revoke")}</span>,
				sortable: false,
				locked: true,
				align: "end",
				width: "1%",
				cell: (session) => (
					<ConfirmDialog
						trigger={
							<Button variant="destructive" size="sm">
								{t("revoke")}
							</Button>
						}
						title={t("revokeTitle")}
						description={
							session.current ? t("revokeCurrentDescription") : t("revokeDescription", { name: session.account.displayName })
						}
						confirmLabel={t("revokeConfirm")}
						destructive
						onConfirm={() => revoke(session.id, session.current)}
					/>
				),
			},
		],
		[t, dates, deviceLabel, revoke],
	);

	const filters = useMemo<DataTableFilter<SessionDto>[]>(
		() => [
			{
				id: "role",
				label: t("columns.role"),
				value: (session) => session.account.role,
				options: ROLES.map((role) => ({ value: role, label: tRoles(role) })),
			},
		],
		[t, tRoles],
	);

	// The own session stays on top; everything else is sorted by the table.
	const sessions = useMemo(() => (data ? [...data.sessions].sort((a, b) => Number(b.current) - Number(a.current)) : []), [data]);

	return (
		<Page>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					<ConfirmDialog
						trigger={
							<Button variant="destructive" disabled={!data}>
								{t("revokeAll")}
							</Button>
						}
						title={t("revokeAllTitle")}
						description={t("revokeAllDescription")}
						confirmLabel={t("revokeAllConfirm")}
						destructive
						onConfirm={revokeAll}
					/>
				}
			/>

			{error ? (
				<ErrorState error={error} onRetry={() => void reload()} />
			) : (
				<DataTable
					label={t("title")}
					columns={columns}
					data={sessions}
					getRowId={(session) => session.id}
					loading={!data}
					filters={filters}
					searchPlaceholder={t("searchPlaceholder")}
					emptyTitle={t("emptyTitle")}
					emptyDescription={t("emptyDescription")}
					renderCard={(session) => (
						<div className="flex min-w-0 flex-col gap-1.5">
							<span className="flex flex-wrap items-center gap-2">
								<Link href={`/users/${session.account.id}`} className="font-medium hover:underline">
									{session.account.displayName}
								</Link>
								<RoleBadge role={session.account.role} />
								{session.current ? <Badge>{t("current")}</Badge> : null}
								{session.secondFactor ? <SecondFactorBadge /> : null}
							</span>
							<span className="text-xs text-muted-foreground">
								{[session.account.email, deviceLabel(session.userAgent), session.ipAddress].filter(Boolean).join(" · ")}
							</span>
							<span className="text-xs text-muted-foreground">
								{t("lastActive", { time: dates.relative(session.lastSeenAt) })}
							</span>
							<ConfirmDialog
								trigger={
									<Button variant="destructive" size="sm" className="mt-1 w-fit">
										{t("revoke")}
									</Button>
								}
								title={t("revokeTitle")}
								description={
									session.current
										? t("revokeCurrentDescription")
										: t("revokeDescription", { name: session.account.displayName })
								}
								confirmLabel={t("revokeConfirm")}
								destructive
								onConfirm={() => revoke(session.id, session.current)}
							/>
						</div>
					)}
				/>
			)}
		</Page>
	);
}
