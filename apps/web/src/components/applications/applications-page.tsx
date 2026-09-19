"use client";

import type { ClientDto, ClientListResponse } from "@aegis/contracts";
import { ArrowRight, Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { AppAvatar } from "@/components/app-avatar";
import { Page, PageHeader } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn, DataTableFilter } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useApiQuery } from "@/hooks/use-api-query";
import { APPLICATION_KINDS, applicationKindOf, KIND_ICONS } from "@/lib/applications";
import { useDateFormat } from "@/lib/format";

export function ApplicationsPage() {
	const t = useTranslations("applications");
	const tKinds = useTranslations("applicationKinds");
	const tStatus = useTranslations("accountStatus");
	const dates = useDateFormat();
	const { data, error, reload } = useApiQuery<ClientListResponse>("/applications");

	const columns = useMemo<DataTableColumn<ClientDto>[]>(
		() => [
			{
				id: "application",
				header: t("columns.application"),
				locked: true,
				flexible: true,
				value: (client) => client.name,
				cell: (client) => (
					<div className="flex min-w-0 items-center gap-3">
						<AppAvatar name={client.name} src={client.logoUrl} />
						<div className="flex min-w-0 flex-col">
							<span className="flex min-w-0 items-center gap-2">
								<span className="truncate font-medium">{client.name}</span>
								{client.enabled ? null : <Badge variant="secondary">{t("disabled")}</Badge>}
							</span>
							<span className="truncate text-xs text-muted-foreground">{tKinds(`${applicationKindOf(client)}.title`)}</span>
						</div>
					</div>
				),
			},
			{
				id: "clientId",
				header: t("columns.clientId"),
				value: (client) => client.id,
				hideBelow: "lg",
				cell: (client) => <code className="truncate font-mono text-xs text-muted-foreground">{client.id}</code>,
			},
			{
				id: "kind",
				header: t("columns.kind"),
				value: (client) => tKinds(`${applicationKindOf(client)}.title`),
				hiddenByDefault: true,
				cell: (client) => <span className="text-sm">{tKinds(`${applicationKindOf(client)}.title`)}</span>,
			},
			{
				id: "access",
				header: t("columns.access"),
				value: (client) => (client.accessPolicy === "everyone" ? -1 : client.assignedUserCount),
				searchable: false,
				hideBelow: "lg",
				cell: (client) => (
					<span className="text-sm text-muted-foreground">
						{client.accessPolicy === "everyone"
							? t("access.everyone")
							: t("access.assigned", { count: client.assignedUserCount })}
					</span>
				),
			},
			{
				id: "sessions",
				header: t("columns.sessions"),
				value: (client) => client.activeSessionCount,
				searchable: false,
				align: "end",
				hideBelow: "md",
				cell: (client) => <span className="text-sm tabular-nums text-muted-foreground">{client.activeSessionCount}</span>,
			},
			{
				id: "lastAuthorizedAt",
				header: t("columns.lastUsedColumn"),
				value: (client) => (client.lastAuthorizedAt ? new Date(client.lastAuthorizedAt) : null),
				searchable: false,
				hideBelow: "md",
				cell: (client) => (
					<span className="text-sm text-muted-foreground">
						{client.lastAuthorizedAt ? dates.relative(client.lastAuthorizedAt) : t("neverUsed")}
					</span>
				),
			},
			{
				id: "createdAt",
				header: t("columns.createdAt"),
				value: (client) => new Date(client.createdAt),
				searchable: false,
				hiddenByDefault: true,
				cell: (client) => <span className="text-sm text-muted-foreground">{dates.date(client.createdAt)}</span>,
			},
		],
		[t, tKinds, dates],
	);

	const filters = useMemo<DataTableFilter<ClientDto>[]>(
		() => [
			{
				id: "kind",
				label: t("columns.kind"),
				value: (client) => applicationKindOf(client),
				options: APPLICATION_KINDS.map((kind) => ({ value: kind, label: tKinds(`${kind}.title`) })),
			},
			{
				id: "status",
				label: t("columns.status"),
				value: (client) => (client.enabled ? "enabled" : "disabled"),
				options: [
					{ value: "enabled", label: tStatus("enabled") },
					{ value: "disabled", label: tStatus("disabled") },
				],
			},
		],
		[t, tKinds, tStatus],
	);

	return (
		<Page>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					data && data.clients.length > 0 ? (
						<Button asChild>
							<Link href="/applications/new">
								<Plus />
								{t("new")}
							</Link>
						</Button>
					) : undefined
				}
			/>

			{error ? (
				<ErrorState error={error} onRetry={() => void reload()} />
			) : !data ? (
				<LoadingState rows={3} className="h-18" />
			) : data.clients.length === 0 ? (
				<EmptyApplications />
			) : (
				<DataTable
					label={t("title")}
					columns={columns}
					data={data.clients}
					getRowId={(client) => client.id}
					filters={filters}
					searchPlaceholder={t("searchPlaceholder")}
					rowHref={(client) => `/applications/${client.id}`}
					defaultState={{ sort: { columnId: "application", direction: "asc" } }}
					renderCard={(client) => (
						<div className="flex min-w-0 items-center gap-3">
							<AppAvatar name={client.name} src={client.logoUrl} />
							<div className="flex min-w-0 flex-col gap-0.5">
								<span className="flex min-w-0 items-center gap-2">
									<span className="truncate font-medium">{client.name}</span>
									{client.enabled ? null : <Badge variant="secondary">{t("disabled")}</Badge>}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{tKinds(`${applicationKindOf(client)}.title`)}
								</span>
								<span className="truncate text-xs text-muted-foreground">
									{client.lastAuthorizedAt
										? t("lastUsed", { time: dates.relative(client.lastAuthorizedAt) })
										: t("neverUsed")}
								</span>
							</div>
						</div>
					)}
				/>
			)}
		</Page>
	);
}

/** Empty state that doubles as the entry point of the creation wizard. */
function EmptyApplications() {
	const t = useTranslations("applications");
	const tKinds = useTranslations("applicationKinds");

	return (
		<Card className="items-center gap-8 px-6 py-12 text-center">
			<div className="flex max-w-md flex-col gap-2">
				<h2 className="text-lg font-semibold tracking-tight">{t("emptyTitle")}</h2>
				<p className="text-sm text-muted-foreground">{t("emptyDescription")}</p>
			</div>
			<div className="grid w-full max-w-3xl gap-3 md:grid-cols-3">
				{APPLICATION_KINDS.map((kind) => {
					const Icon = KIND_ICONS[kind];
					return (
						<Link
							key={kind}
							href={`/applications/new?kind=${kind}`}
							className="group flex flex-col gap-3 rounded-xl border bg-background p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
						>
							<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
								<Icon className="size-5" />
							</span>
							<span className="flex flex-col gap-1">
								<span className="font-medium">{tKinds(`${kind}.title`)}</span>
								<span className="text-sm text-muted-foreground">{tKinds(`${kind}.description`)}</span>
							</span>
							<span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-primary">
								{t("new")}
								<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
							</span>
						</Link>
					);
				})}
			</div>
		</Card>
	);
}
