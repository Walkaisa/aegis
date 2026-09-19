"use client";

import {
	CLIENT_ACCESS_POLICIES,
	type ClientAccessPolicy,
	type ClientResponse,
	type ClientUserDto,
	type ClientUserListResponse,
	type UserListResponse,
} from "@aegis/contracts";
import { Globe, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { type FormEvent, type ReactNode, useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { useApplication } from "@/components/applications/application-layout";
import { clientValuesOf } from "@/components/applications/client-form";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { Section } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn } from "@/components/data-table/types";
import { SearchSelect } from "@/components/search-select";
import { StatusMessage } from "@/components/status-message";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { RoleBadge, UserAvatar } from "@/components/users/account-badges";
import { OPTION_CARD } from "@/components/users/new-user-page";
import { useApiQuery } from "@/hooks/use-api-query";
import { useErrorMessage } from "@/hooks/use-error-message";
import { api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

const POLICY_ICONS = { everyone: Globe, assigned: UsersRound } as const;

/** The access tab of an application: who may sign in, and the accounts assigned to it. */
export function ApplicationAccess() {
	const { client } = useApplication();

	return (
		<div className="flex max-w-4xl flex-col gap-6">
			<PolicySection key={`policy-${client.updatedAt}`} />
			<AssignedAccounts />
		</div>
	);
}

function PolicySection() {
	const t = useTranslations("applicationAccess");
	const errorMessage = useErrorMessage();
	const { client, path, setClient } = useApplication();
	const [policy, setPolicy] = useState<ClientAccessPolicy>(client.accessPolicy);
	const [submitting, setSubmitting] = useState(false);
	const changed = policy !== client.accessPolicy;

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setSubmitting(true);
		try {
			// Saving replaces all settings of the application; only the policy changes here.
			const result = await api.put<ClientResponse>(path, { ...clientValuesOf(client), accessPolicy: policy });
			setClient(result.client);
			toast.success(t("saved"));
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<form onSubmit={onSubmit} noValidate>
			<Section
				title={t("title")}
				description={t("description")}
				footer={
					<Button type="submit" disabled={!changed || submitting}>
						{submitting ? <Spinner /> : null}
						{t("save")}
					</Button>
				}
			>
				<div className="flex flex-col gap-4">
					<RadioGroup
						value={policy}
						onValueChange={(value) => setPolicy(value as ClientAccessPolicy)}
						className="grid gap-3 sm:grid-cols-2"
						aria-label={t("title")}
					>
						{CLIENT_ACCESS_POLICIES.map((option) => {
							const Icon = POLICY_ICONS[option];
							return (
								<label key={option} htmlFor={`access-${option}`} className={cn(OPTION_CARD, "flex flex-col gap-3 p-4")}>
									<span className="flex items-start justify-between gap-2">
										<span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
											<Icon className="size-5" />
										</span>
										<RadioGroupItem value={option} id={`access-${option}`} />
									</span>
									<span className="flex flex-col gap-1">
										<span className="font-medium">{t(`policies.${option}.title`)}</span>
										<span className="text-sm text-muted-foreground">{t(`policies.${option}.description`)}</span>
									</span>
								</label>
							);
						})}
					</RadioGroup>

					{changed && policy === "assigned" ? (
						<StatusMessage tone="warning" title={t("restrictTitle")}>
							{t("restrictWarning", { name: client.name })}
						</StatusMessage>
					) : null}
				</div>
			</Section>
		</form>
	);
}

function AssignedAccounts() {
	const t = useTranslations("applicationAccess");
	const dates = useDateFormat();
	const { client, path, reload: reloadClient } = useApplication();
	const { data, error, reload } = useApiQuery<ClientUserListResponse>(`${path}/users`);
	const [assigning, setAssigning] = useState(false);

	const refresh = useCallback(async () => {
		await Promise.all([reload(), reloadClient()]);
	}, [reload, reloadClient]);

	const remove = useCallback(
		async (account: ClientUserDto) => {
			await api.delete(`${path}/users/${account.id}`);
			toast.success(t("removedToast", { account: account.displayName }));
			await refresh();
		},
		[path, refresh, t],
	);

	const removeDialog = useCallback(
		(account: ClientUserDto, trigger: ReactNode) => (
			<ConfirmDialog
				trigger={trigger}
				title={t("removeTitle")}
				description={t("removeDescription", { account: account.displayName, name: client.name })}
				confirmLabel={t("removeConfirm")}
				destructive
				onConfirm={() => remove(account)}
			/>
		),
		[t, client.name, remove],
	);

	const columns = useMemo<DataTableColumn<ClientUserDto>[]>(
		() => [
			{
				id: "account",
				header: t("columns.account"),
				locked: true,
				flexible: true,
				value: (account) => `${account.displayName} ${account.email}`,
				cell: (account) => (
					<div className="flex min-w-0 items-center gap-3">
						<UserAvatar name={account.displayName} src={account.avatarUrl} />
						<div className="flex min-w-0 flex-col">
							<Link href={`/users/${account.id}`} className="truncate font-medium hover:underline">
								{account.displayName}
							</Link>
							<span className="truncate text-xs text-muted-foreground">{account.email}</span>
						</div>
					</div>
				),
			},
			{
				id: "role",
				header: t("columns.role"),
				value: (account) => account.role,
				searchable: false,
				hideBelow: "md",
				cell: (account) => <RoleBadge role={account.role} />,
			},
			{
				id: "assignedAt",
				header: t("columns.assignedAt"),
				value: (account) => new Date(account.assignedAt),
				searchable: false,
				hideBelow: "lg",
				cell: (account) => (
					<span className="text-sm text-muted-foreground" title={dates.dateTime(account.assignedAt)}>
						{dates.relative(account.assignedAt)}
					</span>
				),
			},
			{
				id: "actions",
				header: <span className="sr-only">{t("remove")}</span>,
				sortable: false,
				locked: true,
				align: "end",
				width: "1%",
				cell: (account) =>
					removeDialog(
						account,
						<Button variant="destructive" size="sm">
							{t("remove")}
						</Button>,
					),
			},
		],
		[t, dates, removeDialog],
	);

	return (
		<Section
			title={t("assignedTitle")}
			description={t("assignedDescription", { name: client.name })}
			action={
				<Button size="sm" onClick={() => setAssigning(true)}>
					<UserPlus />
					{t("assign")}
				</Button>
			}
			contentClassName="p-0"
		>
			{error ? (
				<div className="p-5">
					<ErrorState error={error} onRetry={() => void reload()} />
				</div>
			) : (
				<div className="flex flex-col gap-3 p-5">
					{client.accessPolicy === "everyone" ? <StatusMessage tone="info">{t("inactiveNotice")}</StatusMessage> : null}
					<DataTable
						label={t("assignedTitle")}
						columns={columns}
						data={data?.users ?? []}
						getRowId={(account) => account.id}
						loading={!data}
						searchPlaceholder={t("searchPlaceholder")}
						emptyTitle={t("emptyTitle")}
						emptyDescription={t("emptyDescription")}
						defaultState={{ sort: { columnId: "account", direction: "asc" }, pageSize: 10 }}
						pageSizeOptions={[10, 25, 50]}
						renderCard={(account) => (
							<div className="flex min-w-0 flex-col gap-1">
								<Link href={`/users/${account.id}`} className="truncate font-medium hover:underline">
									{account.displayName}
								</Link>
								<span className="truncate text-xs text-muted-foreground">{account.email}</span>
								{removeDialog(
									account,
									<Button variant="destructive" size="sm" className="mt-1 w-fit">
										{t("remove")}
									</Button>,
								)}
							</div>
						)}
					/>
				</div>
			)}

			<AssignDialog open={assigning} onOpenChange={setAssigning} assigned={data?.users ?? []} onAssigned={refresh} />
		</Section>
	);
}

function AssignDialog({
	open,
	onOpenChange,
	assigned,
	onAssigned,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	assigned: ClientUserDto[];
	onAssigned: () => Promise<void>;
}) {
	const t = useTranslations("applicationAccess");
	const tCommon = useTranslations("common");
	const errorMessage = useErrorMessage();
	const { client, path } = useApplication();
	const { data } = useApiQuery<UserListResponse>(open ? "/users" : null);
	const [userId, setUserId] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const options = useMemo(() => {
		const taken = new Set(assigned.map((account) => account.id));
		return (data?.users ?? [])
			.filter((user) => !taken.has(user.id))
			.map((user) => ({
				value: user.id,
				label: user.displayName,
				hint: user.email,
				keywords: [user.email],
				icon: <UserAvatar name={user.displayName} src={user.avatarUrl} size="sm-round" className="size-5" />,
			}));
	}, [assigned, data]);

	function close() {
		if (submitting) {
			return;
		}
		setUserId("");
		onOpenChange(false);
	}

	async function submit() {
		const account = data?.users.find((user) => user.id === userId);
		if (!account) {
			return;
		}
		setSubmitting(true);
		try {
			await api.put(`${path}/users/${account.id}`);
			toast.success(t("assignedToast", { account: account.displayName }));
			setUserId("");
			onOpenChange(false);
			await onAssigned();
		} catch (error) {
			toast.error(errorMessage(error));
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("assignTitle")}</DialogTitle>
					<DialogDescription>{t("assignDescription", { name: client.name })}</DialogDescription>
				</DialogHeader>

				<Field>
					<FieldLabel htmlFor="assign-account">{t("assignLabel")}</FieldLabel>
					<SearchSelect
						id="assign-account"
						value={userId}
						onChange={setUserId}
						options={options}
						placeholder={t("assignPlaceholder")}
						searchPlaceholder={t("assignSearch")}
						emptyMessage={t("assignEmpty")}
						disabled={!data}
					/>
				</Field>

				<DialogFooter>
					<Button variant="outline" disabled={submitting} onClick={close}>
						{tCommon("cancel")}
					</Button>
					<Button disabled={!userId || submitting} onClick={() => void submit()}>
						{submitting ? <Spinner /> : null}
						{t("assignConfirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
