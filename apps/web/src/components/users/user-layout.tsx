"use client";

import type { UserDto, UserResponse } from "@aegis/contracts";
import { CircleCheck, CircleSlash, KeyRound, LogIn, MonitorSmartphone, SearchX } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { CopyMenuItem } from "@/components/actions-menu";
import { EditableAvatar } from "@/components/avatar-editor";
import { useAccount } from "@/components/dashboard/account-context";
import { useBreadcrumbs } from "@/components/dashboard/breadcrumbs";
import { BackLink, FactGrid, HeroCard, Page, PageHeader } from "@/components/dashboard/page";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { TabNav } from "@/components/dashboard/tab-nav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { useApiQuery } from "@/hooks/use-api-query";
import { api } from "@/lib/api";
import { useDateFormat } from "@/lib/format";

interface UserContextValue {
	user: UserDto;
	/** API path of the account, e.g. `/users/<id>`. */
	path: string;
	/** Whether this is the signed-in admin's own account. */
	self: boolean;
	setUser: (user: UserDto) => void;
	reload: () => Promise<void>;
	/** Actions that end the own session lead back to the sign-in page. */
	signOutSelf: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function useUser(): UserContextValue {
	const value = useContext(UserContext);
	if (!value) {
		throw new Error("useUser must be used inside <UserLayout>");
	}
	return value;
}

/** Header and tab navigation shared by all pages of a single account. */
export function UserLayout({ id, children }: { id: string; children: ReactNode }) {
	const t = useTranslations("userDetail");
	const pathname = usePathname();
	const { me, update: updateMe } = useAccount();
	const path = `/users/${encodeURIComponent(id)}`;
	const { data, error, reload, setData } = useApiQuery<UserResponse>(path);
	const dates = useDateFormat();

	// `Aegis › Users › <name> › Sessions`
	const loaded = data?.user;
	const loadedBase = loaded ? `/users/${loaded.id}` : "";
	const tab = loadedBase && pathname.startsWith(`${loadedBase}/`) ? pathname.slice(loadedBase.length + 1) : null;
	useBreadcrumbs(
		loaded
			? [{ label: loaded.displayName, href: loadedBase }, ...(tab && t.has(`tabs.${tab}`) ? [{ label: t(`tabs.${tab}`) }] : [])]
			: null,
	);

	const value = useMemo<UserContextValue | null>(
		() =>
			data
				? {
						user: data.user,
						path,
						self: data.user.id === me.account.id,
						setUser: (user) => setData({ user }),
						reload,
						signOutSelf: () => window.location.assign("/sign-in"),
					}
				: null,
		[data, path, me.account.id, reload, setData],
	);

	const back = <BackLink href="/users">{t("back")}</BackLink>;

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
							<Link href="/users">{t("back")}</Link>
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

	const { user, self } = value;
	const base = `/users/${user.id}`;

	/** Keeps the page and, for the own account, the sidebar in sync with the new picture. */
	function applyAvatar(result: UserResponse) {
		setData(result);
		if (self) {
			updateMe({ ...me, account: result.user });
		}
	}

	return (
		<UserContext.Provider value={value}>
			<Page className="gap-6">
				{back}
				<HeroCard menu={<CopyMenuItem value={user.id} label={t("copyId")} copiedMessage={t("idCopied")} />}>
					<div className="relative p-5 pt-8 pr-14 sm:p-6 sm:pr-16">
						<PageHeader
							media={
								<EditableAvatar
									name={user.displayName}
									src={user.avatarUrl}
									onUpload={async (image) => applyAvatar(await api.upload<UserResponse>(`${path}/avatar`, image))}
									onRemove={async () => applyAvatar(await api.delete<UserResponse>(`${path}/avatar`))}
								/>
							}
							title={
								<span className="flex flex-wrap items-center gap-3">
									{user.displayName}
									{self ? <Badge variant="secondary">{t("you")}</Badge> : null}
								</span>
							}
							description={user.email}
						/>
					</div>
					<FactGrid
						integrated
						facts={[
							{
								icon: user.enabled ? <CircleCheck /> : <CircleSlash />,
								label: t("facts.status"),
								value: user.enabled ? t("facts.enabled") : t("facts.disabled"),
								hint: user.enabled ? t("statusEnabledDescription") : t("statusDisabledDescription"),
							},
							{
								icon: <LogIn />,
								label: t("detailLabels.lastSignIn"),
								value: user.lastSignInAt ? dates.relative(user.lastSignInAt) : t("never"),
								hint: user.lastSignInAt ? dates.dateTime(user.lastSignInAt) : undefined,
							},
							{
								icon: <MonitorSmartphone />,
								label: t("detailLabels.sessions"),
								value: user.activeSessionCount,
								hint: t("activeSessions", { count: user.activeSessionCount }),
							},
							{
								icon: <KeyRound />,
								label: t("detailLabels.passwordChanged"),
								value: dates.relative(user.passwordChangedAt),
								hint: dates.dateTime(user.passwordChangedAt),
							},
						]}
					/>
				</HeroCard>

				<TabNav
					label={user.displayName}
					items={[
						{ href: base, label: t("tabs.overview") },
						{ href: `${base}/settings`, label: t("tabs.settings") },
						{ href: `${base}/applications`, label: t("tabs.applications") },
						{ href: `${base}/sessions`, label: t("tabs.sessions"), count: user.activeSessionCount },
					]}
				/>

				<div className="min-w-0">{children}</div>
			</Page>
		</UserContext.Provider>
	);
}
