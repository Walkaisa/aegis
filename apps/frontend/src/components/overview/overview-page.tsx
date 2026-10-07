"use client";

import type { OverviewDto } from "@aegis/contracts";
import { AppWindow, ArrowRight, Check, MonitorSmartphone, Plus, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AppAvatar } from "@/components/app-avatar";
import { useAccount } from "@/components/dashboard/account-context";
import { EventList } from "@/components/dashboard/event-list";
import { Page, PageHeader, Section } from "@/components/dashboard/page";
import { StatCard } from "@/components/dashboard/stat-card";
import { ErrorState, LoadingState } from "@/components/dashboard/states";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";
import { useApiQuery } from "@/hooks/use-api-query";
import { cn } from "@/lib/utils";

export function OverviewPage() {
	const t = useTranslations("overview");
	const { me } = useAccount();
	const { data, error, reload } = useApiQuery<OverviewDto>("/overview");
	const stats = data?.stats;

	return (
		<Page>
			<PageHeader
				title={t("greeting", { name: me.account.displayName })}
				description={t("description")}
				actions={
					<Button asChild>
						<Link href="/applications/new">
							<Plus />
							{t("newApplication")}
						</Link>
					</Button>
				}
			/>

			{error ? <ErrorState error={error} onRetry={() => void reload()} /> : null}

			{data && !onboardingComplete(data, me.account.twoFactorEnabled) ? (
				<GettingStarted data={data} twoFactorEnabled={me.account.twoFactorEnabled} />
			) : null}

			<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
				<StatCard label={t("stats.applications")} icon={<AppWindow />} value={stats?.applications ?? null} />
				<StatCard label={t("stats.users")} icon={<Users />} value={stats?.users ?? null} />
				<StatCard label={t("stats.activeSessions")} icon={<MonitorSmartphone />} value={stats?.activeSessions ?? null} />
				<StatCard
					label={t("stats.failedSignIns24h")}
					icon={<ShieldAlert />}
					tone="danger"
					value={stats?.failedSignIns24h ?? null}
				/>
			</section>

			<div className="grid gap-6 lg:grid-cols-3">
				<ActivityChart data={data} className="lg:col-span-2" />
				<TopApplications data={data} />
			</div>

			<Section
				title={t("recentActivity")}
				description={t("recentActivityDescription")}
				action={
					<Button asChild variant="ghost" size="sm">
						<Link href="/audit">
							{t("viewAll")}
							<ArrowRight />
						</Link>
					</Button>
				}
			>
				{!data ? (
					<LoadingState rows={4} className="h-12" />
				) : data.recentEvents.length === 0 ? (
					<p className="py-6 text-center text-sm text-muted-foreground">{t("noActivity")}</p>
				) : (
					<EventList events={data.recentEvents} />
				)}
			</Section>
		</Page>
	);
}

function ActivityChart({ data, className }: { data: OverviewDto | undefined; className?: string }) {
	const t = useTranslations("overview.activity");
	const format = useFormatter();

	const config = {
		succeeded: { label: t("succeeded"), color: "var(--primary)" },
		failed: { label: t("failed"), color: "var(--destructive)" },
	} satisfies ChartConfig;

	const days = data?.activity ?? [];
	const succeeded = days.reduce((total, day) => total + day.succeeded, 0);
	const failed = days.reduce((total, day) => total + day.failed, 0);
	const total = succeeded + failed;
	const dayLabel = (date: string) => format.dateTime(new Date(`${date}T00:00:00Z`), { day: "numeric", month: "short", timeZone: "UTC" });

	return (
		<Section
			className={className}
			title={t("title")}
			description={t("description")}
			action={
				data ? (
					<div className="hidden items-center gap-5 text-right sm:flex">
						<Figure label={t("total")} value={format.number(total)} />
						<Figure
							label={t("failureRate")}
							value={format.number(total === 0 ? 0 : failed / total, { style: "percent", maximumFractionDigits: 1 })}
						/>
					</div>
				) : undefined
			}
		>
			{!data ? (
				<LoadingState rows={1} className="h-60" />
			) : (
				<ChartContainer config={config} className="aspect-auto h-60 w-full">
					<BarChart data={days} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="22%">
						<CartesianGrid vertical={false} strokeDasharray="3 3" />
						<XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={16} tickFormatter={dayLabel} />
						<YAxis tickLine={false} axisLine={false} allowDecimals={false} width={44} />
						<ChartTooltip
							cursor={{ radius: 6 }}
							content={<ChartTooltipContent labelFormatter={(value) => dayLabel(String(value))} />}
						/>
						<ChartLegend content={<ChartLegendContent />} />
						<Bar
							dataKey="succeeded"
							stackId="sign-ins"
							fill="var(--color-succeeded)"
							stroke="var(--card)"
							strokeWidth={1}
							radius={0}
						/>
						<Bar
							dataKey="failed"
							stackId="sign-ins"
							fill="var(--color-failed)"
							stroke="var(--card)"
							strokeWidth={1}
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ChartContainer>
			)}
		</Section>
	);
}

function Figure({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col">
			<span className="text-xs text-muted-foreground">{label}</span>
			<span className="text-lg font-semibold tabular-nums">{value}</span>
		</div>
	);
}

function TopApplications({ data }: { data: OverviewDto | undefined }) {
	const t = useTranslations("overview.topApplications");
	const format = useFormatter();
	const entries = data?.topApplications ?? [];
	const max = Math.max(1, ...entries.map((entry) => entry.authorizations));

	return (
		<Section title={t("title")} description={t("description")}>
			{!data ? (
				<LoadingState rows={4} className="h-10" />
			) : entries.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-3 py-8 text-center">
					<span className="flex size-11 items-center justify-center rounded-xl bg-muted text-muted-foreground">
						<AppWindow className="size-5" />
					</span>
					<p className="max-w-56 text-sm text-muted-foreground">{t("empty")}</p>
				</div>
			) : (
				<ol className="flex flex-col gap-1">
					{entries.map((entry, index) => {
						const body = (
							<>
								<span className="w-4 shrink-0 text-xs font-medium text-muted-foreground tabular-nums">{index + 1}</span>
								<AppAvatar name={entry.name} src={entry.logoUrl} size="sm" />
								<div className="flex min-w-0 flex-1 flex-col gap-1.5">
									<div className="flex items-baseline justify-between gap-2">
										<span className="truncate text-sm font-medium">{entry.name}</span>
										<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
											{format.number(entry.authorizations)}
										</span>
									</div>
									<div className="h-1.5 overflow-hidden rounded-full bg-muted">
										<div
											className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
											style={{ width: `${(entry.authorizations / max) * 100}%` }}
										/>
									</div>
								</div>
							</>
						);
						return (
							<li key={entry.id}>
								<Link
									href={`/applications/${entry.id}`}
									className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/60"
								>
									{body}
								</Link>
							</li>
						);
					})}
				</ol>
			)}
		</Section>
	);
}

/** A sign-in through a registered application has been recorded (last 30 days). */
function hasApplicationSignIn(data: OverviewDto): boolean {
	return data.topApplications.some((entry) => entry.authorizations > 0);
}

/** The checklist disappears once an application exists, has been signed in to and the own account is secured. */
function onboardingComplete(data: OverviewDto, twoFactorEnabled: boolean): boolean {
	return data.stats.applications > 0 && hasApplicationSignIn(data) && twoFactorEnabled;
}

/** Onboarding checklist, shown until every step is done. */
function GettingStarted({ data, twoFactorEnabled }: { data: OverviewDto; twoFactorEnabled: boolean }) {
	const t = useTranslations("overview.gettingStarted");
	const hasApplication = data.stats.applications > 0;
	const steps = [
		{ key: "secure", done: twoFactorEnabled, href: "/settings/account#two-factor", available: true },
		{ key: "application", done: hasApplication, href: "/applications/new", available: true },
		{ key: "signIn", done: hasApplicationSignIn(data), href: "/applications", available: hasApplication },
	] as const;
	const doneCount = steps.filter((step) => step.done).length;

	return (
		<Card className="relative gap-0 overflow-hidden py-0">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-linear-to-b from-primary/10 to-transparent"
			/>
			<CardHeader className="relative pt-5">
				<CardTitle className="font-semibold">{t("title")}</CardTitle>
				<CardDescription>{t("description")}</CardDescription>
				<CardAction className="self-center">
					<span className="flex items-center gap-2.5 text-xs text-muted-foreground tabular-nums">
						<span aria-hidden="true" className="hidden gap-1 sm:flex">
							{steps.map((step) => (
								<span
									key={step.key}
									className={cn("h-1.5 w-5 rounded-full", step.done ? "bg-success" : "bg-muted-foreground/20")}
								/>
							))}
						</span>
						{t("progress", { done: doneCount, total: steps.length })}
					</span>
				</CardAction>
			</CardHeader>
			<CardContent className="relative grid gap-3 py-5 md:grid-cols-3">
				{steps.map((step, index) => (
					<div
						key={step.key}
						className={cn("flex flex-col gap-2.5 rounded-xl border bg-background/70 p-4", step.done && "border-success/30")}
					>
						<div className="flex items-center gap-2.5">
							<span
								className={cn(
									"flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
									step.done ? "bg-success text-white" : "bg-primary/10 text-primary",
								)}
							>
								{step.done ? <Check className="size-3.5" /> : index + 1}
							</span>
							<span className={cn("min-w-0 font-medium", step.done && "text-muted-foreground")}>
								{t(`steps.${step.key}.title`)}
							</span>
							{step.done ? (
								<span className="ml-auto shrink-0 rounded-full bg-success/12 px-2 py-0.5 text-[0.6875rem] font-medium text-success">
									{t("done")}
								</span>
							) : null}
						</div>
						<p className="text-sm text-muted-foreground">{t(`steps.${step.key}.description`)}</p>
						{step.done ? null : step.available ? (
							<Button asChild variant="outline" size="sm" className="mt-auto w-fit">
								<Link href={step.href}>
									{t(`steps.${step.key}.action`)}
									<ArrowRight />
								</Link>
							</Button>
						) : (
							<p className="mt-auto text-xs text-muted-foreground/80">{t("steps.signIn.pending")}</p>
						)}
					</div>
				))}
			</CardContent>
		</Card>
	);
}
