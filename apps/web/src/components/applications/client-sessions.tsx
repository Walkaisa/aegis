"use client";

import type { ClientDto, ClientSessionDto, ClientSessionListResponse } from "@aegis/contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { useApplication } from "@/components/applications/application-layout";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { useDeviceLabel } from "@/components/dashboard/device";
import { SectionHeader } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/users/account-badges";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";

/** The sessions tab of an application page. */
export function ApplicationSessions() {
	const { client, path, reload } = useApplication();
	const onRevoked = useCallback(() => void reload(), [reload]);
	return <ClientSessions client={client} path={`${path}/sessions`} onRevoked={onRevoked} />;
}

function ClientSessions({ client, path, onRevoked }: { client: ClientDto; path: string; onRevoked: () => void }) {
	const t = useTranslations("clientSessions");
	const dates = useDateFormat();
	const deviceLabel = useDeviceLabel();
	const { data, error, reload } = useApiQuery<ClientSessionListResponse>(path);

	async function revokeAll() {
		await api.delete(path);
		toast.success(t("revoked", { name: client.name }));
		await reload();
		onRevoked();
	}

	const revoke = useCallback(
		async (session: ClientSessionDto) => {
			await api.delete(`${path}/${session.sessionId}`);
			toast.success(t("sessionRevoked", { name: session.account.displayName }));
			await reload();
			onRevoked();
		},
		[path, t, reload, onRevoked],
	);

	const revokeDialog = useCallback(
		(session: ClientSessionDto, trigger: ReactNode) => (
			<ConfirmDialog
				trigger={trigger}
				title={t("revokeTitle")}
				description={t("revokeDescription", { name: session.account.displayName, client: client.name })}
				confirmLabel={t("revokeConfirm")}
				destructive
				onConfirm={() => revoke(session)}
			/>
		),
		[t, client.name, revoke],
	);

	const columns = useMemo<DataTableColumn<ClientSessionDto>[]>(
		() => [
			{
				id: "account",
				header: t("columns.account"),
				locked: true,
				flexible: true,
				value: (session) => `${session.account.displayName} ${session.account.email}`,
				cell: (session) => (
					<div className="flex min-w-0 items-center gap-3">
						<UserAvatar name={session.account.displayName} src={session.account.avatarUrl} />
						<div className="flex min-w-0 flex-col">
							<Link href={`/users/${session.account.id}`} className="truncate font-medium hover:underline">
								{session.account.displayName}
							</Link>
							<span className="truncate text-xs text-muted-foreground">{session.account.email}</span>
							<span className="truncate text-xs text-muted-foreground md:hidden">{deviceLabel(session.userAgent)}</span>
							<span className="truncate text-xs text-muted-foreground md:hidden">
								{dates.relative(session.lastAuthorizedAt)}
							</span>
						</div>
					</div>
				),
			},
			{
				id: "device",
				header: t("columns.device"),
				value: (session) => deviceLabel(session.userAgent),
				hideBelow: "md",
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
				id: "lastAuthorizedAt",
				header: t("columns.lastSignIn"),
				value: (session) => new Date(session.lastAuthorizedAt),
				searchable: false,
				hideBelow: "md",
				cell: (session) => (
					<span className="text-sm text-muted-foreground" title={dates.dateTime(session.lastAuthorizedAt)}>
						{dates.relative(session.lastAuthorizedAt)}
					</span>
				),
			},
			{
				id: "firstAuthorizedAt",
				header: t("columns.firstSignIn"),
				value: (session) => new Date(session.firstAuthorizedAt),
				searchable: false,
				hideBelow: "lg",
				cell: (session) => <span className="text-sm text-muted-foreground">{dates.dateTime(session.firstAuthorizedAt)}</span>,
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
				cell: (session) =>
					revokeDialog(
						session,
						<Button variant="destructive" size="sm">
							{t("revoke")}
						</Button>,
					),
			},
		],
		[t, dates, deviceLabel, revokeDialog],
	);

	return (
		<div className="flex flex-col gap-6">
			<SectionHeader
				title={t("title")}
				description={t("description", { name: client.name })}
				actions={
					data && data.sessions.length > 0 ? (
						<ConfirmDialog
							trigger={<Button variant="destructive">{t("revokeAll")}</Button>}
							title={t("revokeAllTitle")}
							description={t("revokeAllDescription", { name: client.name })}
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
				<div className="flex flex-col gap-3">
					<DataTable
						label={t("title")}
						columns={columns}
						data={data?.sessions ?? []}
						getRowId={(session) => session.sessionId}
						loading={!data}
						searchPlaceholder={t("searchPlaceholder")}
						emptyTitle={t("emptyTitle")}
						emptyDescription={t("emptyDescription")}
						defaultState={{ sort: { columnId: "lastAuthorizedAt", direction: "desc" }, pageSize: 10 }}
						pageSizeOptions={[10, 25, 50]}
					/>
					<p className="text-xs text-muted-foreground">{t("notice")}</p>
				</div>
			)}
		</div>
	);
}
