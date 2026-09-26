"use client";

import type { ClientDto, ClientResponse } from "@aegis/contracts";
import { CircleCheck, CircleSlash, History, Lock, MonitorSmartphone, SearchX, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { CopyMenuItem } from "@/components/actions-menu";
import { EditableAvatar } from "@/components/avatar-editor";
import { useBreadcrumbs } from "@/components/dashboard/breadcrumbs";
import { BackLink, FactGrid, HeroCard, Page, PageHeader } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { TabNav } from "@/components/dashboard/tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { applicationKindOf } from "@/lib/applications";
import { useDateFormat } from "@/lib/format";

interface ApplicationContextValue {
	client: ClientDto;
	/** API path of the application, e.g. `/applications/<id>`. */
	path: string;
	setClient: (client: ClientDto) => void;
	reload: () => Promise<void>;
}

const ApplicationContext = createContext<ApplicationContextValue | null>(null);

export function useApplication(): ApplicationContextValue {
	const value = useContext(ApplicationContext);
	if (!value) {
		throw new Error("useApplication must be used inside <ApplicationLayout>");
	}
	return value;
}

/** Header and tab navigation shared by all pages of a single application. */
export function ApplicationLayout({ id, children }: { id: string; children: ReactNode }) {
	const t = useTranslations("applicationDetail");
	const tKinds = useTranslations("applicationKinds");
	const pathname = usePathname();
	const path = `/applications/${encodeURIComponent(id)}`;
	const { data, error, reload, setData } = useApiQuery<ClientResponse>(path);

	// `Aegis › Applications › <name> › Sessions`
	const loaded = data?.client;
	const loadedBase = loaded ? `/applications/${loaded.id}` : "";
	const tab = loadedBase && pathname.startsWith(`${loadedBase}/`) ? pathname.slice(loadedBase.length + 1) : null;
	useBreadcrumbs(
		loaded ? [{ label: loaded.name, href: loadedBase }, ...(tab && t.has(`tabs.${tab}`) ? [{ label: t(`tabs.${tab}`) }] : [])] : null,
	);

	const value = useMemo<ApplicationContextValue | null>(
		() => (data ? { client: data.client, path, setClient: (client) => setData({ client }), reload } : null),
		[data, path, reload, setData],
	);

	const back = <BackLink href="/applications">{t("back")}</BackLink>;

	if (error?.code === "not_found" || error?.code === "validation_failed") {
		return (
			<Page>
				{back}
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<SearchX />
						</EmptyMedia>
						<EmptyTitle>{t("notFoundTitle")}</EmptyTitle>
						<EmptyDescription>{t("notFoundDescription")}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button asChild variant="outline">
							<Link href="/applications">{t("back")}</Link>
						</Button>
					</EmptyContent>
				</Empty>
			</Page>
		);
	}

	if (!value) {
		return (
			<Page>
				{back}
				{error ? <ErrorState error={error} onRetry={() => void reload()} /> : <LoadingState rows={3} className="h-32" />}
			</Page>
		);
	}

	const { client } = value;
	const base = `/applications/${client.id}`;

	return (
		<ApplicationContext.Provider value={value}>
			<Page className="gap-6">
				{back}
				<HeroCard menu={<CopyMenuItem value={client.id} label={t("copyId")} copiedMessage={t("idCopied")} />}>
					<div className="relative p-5 pt-8 pr-14 sm:p-6 sm:pr-16">
						<PageHeader
							media={
								<EditableAvatar
									kind="application"
									name={client.name}
									src={client.logoUrl}
									onUpload={async (image) => setData(await api.upload<ClientResponse>(`${path}/logo`, image))}
									onRemove={async () => setData(await api.delete<ClientResponse>(`${path}/logo`))}
								/>
							}
							title={
								<span className="flex flex-wrap items-center gap-3">
									<span className="min-w-0 truncate" title={client.name}>
										{client.name}
									</span>
									{client.accessPolicy === "assigned" ? (
										<Tooltip>
											<TooltipTrigger asChild>
												<Badge variant="secondary">
													<Lock />
													{t("restricted")}
												</Badge>
											</TooltipTrigger>
											<TooltipContent>{t("restrictedHint")}</TooltipContent>
										</Tooltip>
									) : null}
								</span>
							}
							description={tKinds(`${applicationKindOf(client)}.title`)}
						/>
					</div>
					<ApplicationStats client={client} />
				</HeroCard>

				<TabNav
					label={client.name}
					items={[
						{ href: base, label: t("tabs.quickstart") },
						{ href: `${base}/settings`, label: t("tabs.settings") },
						{
							href: `${base}/access`,
							label: t("tabs.access"),
							count: client.accessPolicy === "assigned" ? client.assignedUserCount : null,
						},
						{ href: `${base}/sessions`, label: t("tabs.sessions"), count: client.activeSessionCount },
					]}
				/>

				<div className="min-w-0">{children}</div>
			</Page>
		</ApplicationContext.Provider>
	);
}

function ApplicationStats({ client }: { client: ClientDto }) {
	const t = useTranslations("quickstart");
	const tKinds = useTranslations("applicationKinds");
	const dates = useDateFormat();
	const kind = applicationKindOf(client);
	const confidential = client.type === "confidential";
	return (
		<FactGrid
			integrated
			facts={[
				{
					icon: client.enabled ? <CircleCheck /> : <CircleSlash />,
					label: t("facts.status"),
					value: client.enabled ? t("facts.enabled") : t("facts.disabled"),
					hint: client.enabled ? t("facts.enabledHint") : t("facts.disabledHint"),
				},
				{
					icon: <ShieldCheck />,
					label: t("detailLabels.type"),
					value: tKinds(`${kind}.title`),
					hint: confidential ? t("facts.confidential") : t("facts.public"),
				},
				{
					icon: <MonitorSmartphone />,
					label: t("facts.sessions"),
					value: client.activeSessionCount,
					hint: t("facts.sessionsHint", { count: client.activeSessionCount }),
				},
				{
					icon: <History />,
					label: t("detailLabels.lastUsed"),
					value: client.lastAuthorizedAt ? dates.relative(client.lastAuthorizedAt) : t("neverUsed"),
					hint: client.lastAuthorizedAt ? dates.dateTime(client.lastAuthorizedAt) : undefined,
				},
			]}
		/>
	);
}
