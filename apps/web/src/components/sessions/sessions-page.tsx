"use client";

import { ROLES, type SessionDto, type SessionListResponse } from "@aegis/contracts";
import { AppWindow } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppAvatar } from "@/components/app-avatar";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DeviceIcon, useDeviceLabel } from "@/components/dashboard/device";
import { Page, PageHeader } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn, DataTableFilter } from "@/components/data-table/types";
import { SecondFactorBadge } from "@/components/sessions/second-factor-badge";
import { SessionSheet } from "@/components/sessions/session-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleBadge, UserAvatar } from "@/components/users/account-badges";
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
	/** The session shown in the side panel, looked up in the list so it stays current after a reload. */
	const [openId, setOpenId] = useState<string | null>(null);
	/** The session to end; it stays set while the confirmation closes, so its text does not change mid-animation. */
	const [revoking, setRevoking] = useState<SessionDto | null>(null);
	const [confirming, setConfirming] = useState(false);

	function confirmRevoke(session: SessionDto) {
		setRevoking(session);
		setConfirming(true);
	}

	async function revoke(session: SessionDto) {
		await api.delete(`/sessions/${session.id}`);
		if (session.current) {
			window.location.assign("/sign-in");
			return;
		}
		toast.success(t("revoked"));
		setOpenId(null);
		await reload();
	}

	/** Ends every session, the own one included, which signs out of this browser like revoking it alone. */
	async function revokeAll() {
		await api.delete("/sessions");
		window.location.assign("/sign-in");
	}

	const columns = useMemo<DataTableColumn<SessionDto>[]>(
		() => [
			{
				id: "account",
				minWidth: 200,
				priority: 0,
				header: t("columns.account"),
				locked: true,
				flexible: true,
				value: (session) => `${session.account.displayName} ${session.account.email}`,
				cell: (session) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<UserAvatar name={session.account.displayName} src={session.account.avatarUrl} size="sm-round" />
						<div className="flex min-w-0 flex-col">
							<span className="flex min-w-0 items-center gap-2">
								<Link href={`/users/${session.account.id}`} className="truncate text-sm font-medium hover:underline">
									{session.account.displayName}
								</Link>
								{session.current ? <Badge>{t("current")}</Badge> : null}
							</span>
							{/* Where the device column no longer fits, the device takes the place of the address. */}
							<span className="truncate text-xs text-muted-foreground @max-md/table:hidden">{session.account.email}</span>
							<span className="hidden truncate text-xs text-muted-foreground @max-md/table:inline">
								{deviceLabel(session.userAgent)}
							</span>
						</div>
					</div>
				),
			},
			{
				id: "role",
				minWidth: 110,
				priority: 4,
				header: t("columns.role"),
				value: (session) => session.account.role,
				searchable: false,
				cell: (session) => <RoleBadge role={session.account.role} />,
			},
			{
				id: "device",
				minWidth: 190,
				priority: 2,
				header: t("columns.device"),
				// The address is searchable here; the panel of a session shows it.
				value: (session) => `${deviceLabel(session.userAgent)} ${session.ipAddress ?? ""}`,
				cell: (session) => (
					<div className="flex min-w-0 items-center gap-2 text-muted-foreground [&>svg]:size-4 [&>svg]:shrink-0">
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
				minWidth: 140,
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
				id: "secondFactor",
				minWidth: 130,
				priority: 3,
				header: t("columns.signIn"),
				value: (session) => session.secondFactor,
				searchable: false,
				cell: (session) =>
					session.secondFactor ? (
						<SecondFactorBadge />
					) : (
						<span className="block truncate text-sm text-muted-foreground">{t("passwordOnly")}</span>
					),
			},
		],
		[t, dates, deviceLabel],
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
	const openSession = sessions.find((session) => session.id === openId) ?? null;

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
					onRowClick={(session) => setOpenId(session.id)}
					activeRowId={openId}
					loading={!data}
					filters={filters}
					searchPlaceholder={t("searchPlaceholder")}
					emptyTitle={t("emptyTitle")}
					emptyDescription={t("emptyDescription")}
				/>
			)}

			<SessionSheet session={openSession} onClose={() => setOpenId(null)} onRevoke={confirmRevoke} />
			<ConfirmDialog
				open={confirming}
				onOpenChange={setConfirming}
				title={t("revokeTitle")}
				description={
					revoking?.current
						? t("revokeCurrentDescription")
						: t("revokeDescription", { name: revoking?.account.displayName ?? "" })
				}
				confirmLabel={t("revokeConfirm")}
				destructive
				onConfirm={async () => {
					if (revoking) {
						await revoke(revoking);
					}
				}}
			/>
		</Page>
	);
}
