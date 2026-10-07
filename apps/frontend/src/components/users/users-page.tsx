"use client";

import { ROLES, type UserDto, type UserListResponse } from "@aegis/contracts";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { Page, PageHeader } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn, DataTableFilter } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { AccountStatus, RoleBadge, UserAvatar } from "@/components/users/account-badges";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDateFormat } from "@/lib/format";

export function UsersPage() {
	const t = useTranslations("users");
	const tRoles = useTranslations("roles");
	const tStatus = useTranslations("accountStatus");
	const dates = useDateFormat();
	const { data, error, reload } = useApiQuery<UserListResponse>("/users");

	const columns = useMemo<DataTableColumn<UserDto>[]>(
		() => [
			{
				id: "name",
				minWidth: 130,
				priority: 0,
				header: t("columns.name"),
				locked: true,
				flexible: true,
				value: (user) => `${user.displayName} ${user.email}`,
				cell: (user) => (
					<div className="flex min-w-0 items-center gap-3">
						<UserAvatar name={user.displayName} src={user.avatarUrl} />
						<span className="truncate font-medium" title={user.displayName}>
							{user.displayName}
						</span>
					</div>
				),
			},
			{
				id: "role",
				minWidth: 94,
				priority: 2,
				header: t("columns.role"),
				value: (user) => user.role,
				searchable: false,
				cell: (user) => <RoleBadge role={user.role} />,
			},
			{
				id: "status",
				minWidth: 94,
				priority: 1,
				header: t("columns.status"),
				value: (user) => user.enabled,
				searchable: false,
				cell: (user) => <AccountStatus enabled={user.enabled} />,
			},
			{
				id: "email",
				minWidth: 220,
				priority: 4,
				header: t("columns.email"),
				value: (user) => user.email,
				cell: (user) => (
					<span className="block max-w-56 truncate text-muted-foreground" title={user.email}>
						{user.email}
					</span>
				),
			},
			{
				id: "sessions",
				minWidth: 100,
				priority: 5,
				header: t("columns.sessions"),
				value: (user) => user.activeSessionCount,
				searchable: false,
				hiddenByDefault: true,
				align: "end",
				cell: (user) => <span className="text-sm tabular-nums text-muted-foreground">{user.activeSessionCount}</span>,
			},
			{
				id: "createdAt",
				minWidth: 125,
				priority: 6,
				header: t("columns.createdAt"),
				value: (user) => new Date(user.createdAt),
				searchable: false,
				cell: (user) => <span className="block truncate text-sm text-muted-foreground">{dates.date(user.createdAt)}</span>,
			},
			{
				id: "lastSignIn",
				minWidth: 155,
				priority: 3,
				header: t("columns.lastSignIn"),
				value: (user) => (user.lastSignInAt ? new Date(user.lastSignInAt) : null),
				searchable: false,
				cell: (user) => (
					<span className="block truncate text-sm text-muted-foreground">
						{user.lastSignInAt ? dates.relative(user.lastSignInAt) : t("neverSignedIn")}
					</span>
				),
			},
		],
		[t, dates],
	);

	const filters = useMemo<DataTableFilter<UserDto>[]>(
		() => [
			{
				id: "role",
				label: t("columns.role"),
				value: (user) => user.role,
				options: ROLES.map((role) => ({ value: role, label: tRoles(role) })),
			},
			{
				id: "status",
				label: t("columns.status"),
				value: (user) => (user.enabled ? "enabled" : "disabled"),
				options: [
					{ value: "enabled", label: tStatus("enabled") },
					{ value: "disabled", label: tStatus("disabled") },
				],
			},
		],
		[t, tRoles, tStatus],
	);

	return (
		<Page>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					<Button asChild>
						<Link href="/users/new">
							<Plus />
							{t("create")}
						</Link>
					</Button>
				}
			/>

			{error ? (
				<ErrorState error={error} onRetry={() => void reload()} />
			) : (
				<DataTable
					adaptive
					label={t("title")}
					columns={columns}
					data={data?.users ?? []}
					getRowId={(user) => user.id}
					loading={!data}
					filters={filters}
					searchPlaceholder={t("searchPlaceholder")}
					rowHref={(user) => `/users/${user.id}`}
					defaultState={{ sort: { columnId: "name", direction: "asc" } }}
					emptyTitle={t("emptyTitle")}
					emptyDescription={t("emptyDescription")}
				/>
			)}
		</Page>
	);
}
