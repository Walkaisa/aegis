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
				minWidth: 110,
				priority: 0,
				header: t("columns.account"),
				locked: true,
				flexible: true,
				value: (session) => `${session.account.displayName} ${session.account.email}`,
				cell: (session) => (
					<Link
						href={`/users/${session.account.id}`}
						className="block truncate font-medium hover:underline"
						title={session.account.email}
					>
						{session.account.displayName}
					</Link>
				),
			},
			{
				id: "role",
				minWidth: 94,
				priority: 4,
				header: t("columns.role"),
				value: (session) => session.account.role,
				searchable: false,
				cell: (session) => <RoleBadge role={session.account.role} />,
			},
			{
				id: "device",
				minWidth: 185,
				priority: 2,
				header: t("columns.device"),
				value: (session) => deviceLabel(session.userAgent),
				cell: (session) => (
					<div className="flex items-center gap-2 text-muted-foreground [&_svg]:size-4 [&_svg]:shrink-0">
						<DeviceIcon userAgent={session.userAgent} />
						<span className="min-w-0 truncate" title={deviceLabel(session.userAgent)}>
							{deviceLabel(session.userAgent)}
						</span>
					</div>
				),
			},
			{
				id: "applications",
				minWidth: 190,
				priority: 7,
				header: t("columns.applications"),
				value: (session) => session.applications.map((application) => application.name).join(" "),
				cell: (session) =>
					session.applications.length === 0 ? (
						<span className="text-xs text-muted-foreground">{t("noApplications")}</span>
					) : (
						<div className="flex min-w-0 flex-wrap items-center gap-1">
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
				minWidth: 112,
				priority: 1,
				header: t("columns.lastActive"),
				value: (session) => new Date(session.lastSeenAt),
				searchable: false,
				cell: (session) => (
					<span className="block truncate text-sm text-muted-foreground" title={dates.dateTime(session.lastSeenAt)}>
						{dates.relative(session.lastSeenAt)}
					</span>
				),
			},
			{
				id: "email",
				minWidth: 220,
				priority: 8,
				header: t("columns.email"),
				value: (session) => session.account.email,
				hiddenByDefault: true,
				cell: (session) => (
					<span className="block max-w-56 truncate text-muted-foreground" title={session.account.email}>
						{session.account.email}
					</span>
				),
			},
			{
				id: "ipAddress",
				minWidth: 160,
				priority: 6,
				header: t("columns.ipAddress"),
				value: (session) => session.ipAddress,
				cell: (session) => (
					<code className="block max-w-40 truncate text-xs text-muted-foreground" title={session.ipAddress ?? undefined}>
						{session.ipAddress ?? "–"}
					</code>
				),
			},
			{
				id: "status",
				minWidth: 150,
				priority: 3,
				header: t("columns.status"),
				sortable: false,
				cell: (session) => (
					<span className="flex items-center gap-2">
						{session.current ? <Badge>{t("current")}</Badge> : <span className="text-muted-foreground">–</span>}
						{session.secondFactor ? <SecondFactorBadge /> : null}
					</span>
				),
			},
			{
				id: "authenticatedAt",
				minWidth: 170,
				priority: 8,
				header: t("columns.signedInAt"),
				value: (session) => new Date(session.authenticatedAt),
				searchable: false,
				hiddenByDefault: true,
				cell: (session) => (
					<span className="block truncate text-sm text-muted-foreground">{dates.dateTime(session.authenticatedAt)}</span>
				),
			},
			{
				id: "expiresAt",
				minWidth: 170,
				priority: 8,
				header: t("columns.expiresAt"),
				value: (session) => new Date(session.expiresAt),
				searchable: false,
				hiddenByDefault: true,
				cell: (session) => (
					<span className="block truncate text-sm text-muted-foreground">{dates.dateTime(session.expiresAt)}</span>
				),
			},
			{
				id: "actions",
				minWidth: 88,
				priority: 0,
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
					adaptive
					label={t("title")}
					columns={columns}
					data={sessions}
					getRowId={(session) => session.id}
					loading={!data}
					filters={filters}
					searchPlaceholder={t("searchPlaceholder")}
					emptyTitle={t("emptyTitle")}
					emptyDescription={t("emptyDescription")}
				/>
			)}
		</Page>
	);
}
