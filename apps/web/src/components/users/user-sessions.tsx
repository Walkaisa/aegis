"use client";

import type { SessionDto, SessionListResponse, SessionRevocationResponse } from "@aegis/contracts";
import { AppWindow } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { DeviceIcon, useDeviceLabel } from "@/components/dashboard/device";
import { SectionHeader } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn } from "@/components/data-table/types";
import { SecondFactorBadge } from "@/components/sessions/second-factor-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useUser } from "@/components/users/user-layout";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";

/** The sessions tab of an account; mirrors the sessions tab of an application. */
export function UserSessions() {
	const t = useTranslations("userDetail.sessionsTab");
	const tSessions = useTranslations("sessions");
	const dates = useDateFormat();
	const deviceLabel = useDeviceLabel();
	const { user, path, self, reload: reloadUser, signOutSelf } = useUser();
	const { data, error, reload } = useApiQuery<SessionListResponse>(`${path}/sessions`);
	const sessions = data?.sessions ?? [];

	const revoke = useCallback(
		async (session: SessionDto) => {
			await api.delete(`/sessions/${session.id}`);
			if (session.current) {
				signOutSelf();
				return;
			}
			toast.success(tSessions("revoked"));
			await Promise.all([reload(), reloadUser()]);
		},
		[reload, reloadUser, signOutSelf, tSessions],
	);

	async function revokeAll() {
		const { revoked } = await api.delete<SessionRevocationResponse>(`${path}/sessions`);
		toast.success(t("revokedAll", { count: revoked }));
		if (self) {
			signOutSelf();
			return;
		}
		await Promise.all([reload(), reloadUser()]);
	}

	const columns = useMemo<DataTableColumn<SessionDto>[]>(
		() => [
			{
				id: "device",
				header: tSessions("columns.device"),
				locked: true,
				flexible: true,
				value: (session) => `${deviceLabel(session.userAgent)} ${session.ipAddress ?? ""}`,
				cell: (session) => (
					<div className="flex min-w-0 items-center gap-3">
						<span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
							<DeviceIcon userAgent={session.userAgent} />
						</span>
						<div className="flex min-w-0 flex-col">
							<span className="flex min-w-0 items-center gap-2">
								<span className="truncate font-medium">{deviceLabel(session.userAgent)}</span>
								{session.current ? <Badge>{tSessions("current")}</Badge> : null}
								{session.secondFactor ? <SecondFactorBadge /> : null}
							</span>
							<span className="truncate font-mono text-xs text-muted-foreground">{session.ipAddress ?? "–"}</span>
						</div>
					</div>
				),
			},
			{
				id: "applications",
				header: tSessions("columns.applications"),
				value: (session) => session.applications.map((application) => application.name).join(" "),
				hideBelow: "lg",
				cell: (session) =>
					session.applications.length === 0 ? (
						<span className="text-xs text-muted-foreground">{tSessions("noApplications")}</span>
					) : (
						<div className="flex flex-wrap items-center gap-1">
							{session.applications.map((application) => (
								<Badge key={application.id} variant="outline" asChild>
									<Link href={`/applications/${application.id}`}>
										<AppWindow />
										{application.name}
									</Link>
								</Badge>
							))}
						</div>
					),
			},
			{
				id: "lastSeenAt",
				header: tSessions("columns.lastActive"),
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
				id: "expiresAt",
				header: tSessions("columns.expiresAt"),
				value: (session) => new Date(session.expiresAt),
				searchable: false,
				hideBelow: "xl",
				cell: (session) => <span className="text-sm text-muted-foreground">{dates.dateTime(session.expiresAt)}</span>,
			},
			{
				id: "actions",
				header: <span className="sr-only">{tSessions("revoke")}</span>,
				sortable: false,
				locked: true,
				align: "end",
				width: "1%",
				cell: (session) => (
					<ConfirmDialog
						trigger={
							<Button variant="destructive" size="sm">
								{tSessions("revoke")}
							</Button>
						}
						title={tSessions("revokeTitle")}
						description={
							session.current
								? tSessions("revokeCurrentDescription")
								: tSessions("revokeDescription", { name: session.account.displayName })
						}
						confirmLabel={tSessions("revokeConfirm")}
						destructive
						onConfirm={() => revoke(session)}
					/>
				),
			},
		],
		[tSessions, dates, deviceLabel, revoke],
	);

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader
				title={t("title")}
				description={t("description", { name: user.displayName })}
				actions={
					sessions.length > 0 ? (
						<ConfirmDialog
							trigger={<Button variant="destructive">{t("revokeAll")}</Button>}
							title={t("revokeAllTitle")}
							description={t("revokeAllDescription", { name: user.displayName })}
							confirmLabel={t("revokeAllConfirm")}
							destructive
							onConfirm={revokeAll}
						/>
					) : undefined
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
					searchPlaceholder={t("searchPlaceholder")}
					emptyTitle={t("emptyTitle")}
					emptyDescription={t("emptyDescription")}
					defaultState={{ sort: { columnId: "lastSeenAt", direction: "desc" }, pageSize: 10 }}
					pageSizeOptions={[10, 25, 50]}
					renderCard={(session) => (
						<div className="flex min-w-0 flex-col gap-1">
							<span className="flex items-center gap-2 font-medium">
								{deviceLabel(session.userAgent)}
								{session.current ? <Badge>{tSessions("current")}</Badge> : null}
								{session.secondFactor ? <SecondFactorBadge /> : null}
							</span>
							<span className="truncate text-xs text-muted-foreground">
								{[session.ipAddress, tSessions("lastActive", { time: dates.relative(session.lastSeenAt) })]
									.filter(Boolean)
									.join(" · ")}
							</span>
							<ConfirmDialog
								trigger={
									<Button variant="destructive" size="sm" className="mt-1 w-fit">
										{tSessions("revoke")}
									</Button>
								}
								title={tSessions("revokeTitle")}
								description={
									session.current
										? tSessions("revokeCurrentDescription")
										: tSessions("revokeDescription", { name: session.account.displayName })
								}
								confirmLabel={tSessions("revokeConfirm")}
								destructive
								onConfirm={() => revoke(session)}
							/>
						</div>
					)}
				/>
			)}
		</div>
	);
}
