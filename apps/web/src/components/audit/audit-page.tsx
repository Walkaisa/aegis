"use client";

import {
	AUDIT_CATEGORIES,
	AUDIT_DEFAULT_PAGE_SIZE,
	AUDIT_OUTCOMES,
	AUDIT_PAGE_SIZES,
	AUDIT_SEVERITIES,
	AUDIT_SOURCES,
	type AuditEventDto,
	type AuditPageResponse,
	type AuditSeverity,
	type AuditSummaryResponse,
} from "@aegis/contracts";
import { RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AuditDetails } from "@/components/audit/audit-details";
import { AuditActorAvatar, useAuditActor, useAuditText } from "@/components/audit/audit-event";
import { AuditRetentionMenu } from "@/components/audit/audit-retention-menu";
import { AuditSummaryBar } from "@/components/audit/audit-summary-bar";
import { SEVERITY_STYLES } from "@/components/audit/audit-tokens";
import { useDeviceLabel } from "@/components/dashboard/device";
import { Page, PageHeader } from "@/components/dashboard/page";
import { ErrorState } from "@/components/dashboard/states";
import { createTableState, DataTable } from "@/components/data-table/data-table";
import type { DataTableColumn, DataTableFilter, DataTableState } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { api } from "@/lib/api";
import { AUDIT_RANGE_HOURS, type AuditFilters, auditQueryString, DEFAULT_AUDIT_RANGE_HOURS, rangeStart } from "@/lib/audit";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

/** Translates the table state into the filters of the audit API. */
function toFilters(state: DataTableState, search: string, from: string | null): AuditFilters {
	const pick = <T extends string>(id: string, allowed: readonly T[]): T[] =>
		(state.filters[id] ?? []).filter((value): value is T => (allowed as readonly string[]).includes(value));

	return {
		categories: pick("categories", AUDIT_CATEGORIES),
		severities: pick("severities", AUDIT_SEVERITIES),
		outcomes: pick("outcomes", AUDIT_OUTCOMES),
		sources: pick("sources", AUDIT_SOURCES),
		search,
		order: state.sort?.columnId === "occurredAt" && state.sort.direction === "asc" ? "oldest" : "newest",
		from,
		to: null,
	};
}

export function AuditPage() {
	const t = useTranslations("audit");
	const dates = useDateFormat();
	const deviceLabel = useDeviceLabel();
	const actorOf = useAuditActor();
	const textOf = useAuditText();

	const [state, setState] = useState<DataTableState>(() =>
		createTableState({
			pageSize: AUDIT_DEFAULT_PAGE_SIZE,
			sort: { columnId: "occurredAt", direction: "desc" },
		}),
	);
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [rangeHours, setRangeHours] = useState<number>(DEFAULT_AUDIT_RANGE_HOURS);
	const [from, setFrom] = useState<string | null>(() => rangeStart(DEFAULT_AUDIT_RANGE_HOURS));
	const [page, setPage] = useState<AuditPageResponse | null>(null);
	const [summary, setSummary] = useState<AuditSummaryResponse | undefined>(undefined);
	const [error, setError] = useState<unknown>(null);
	const [refreshing, setRefreshing] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(state.search.trim()), SEARCH_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [state.search]);

	// Only the query strings drive a reload; hiding a column must not refetch.
	const { listQuery, summaryQuery } = useMemo(() => {
		const filters = toFilters(state, debouncedSearch, from);
		return {
			listQuery: auditQueryString(filters, { page: state.page, perPage: state.pageSize }),
			summaryQuery: auditQueryString(filters),
		};
	}, [state, debouncedSearch, from]);

	const load = useCallback(async () => {
		setRefreshing(true);
		setError(null);
		try {
			const [events, counts] = await Promise.all([
				api.get<AuditPageResponse>(`/audit/events?${listQuery}`),
				api.get<AuditSummaryResponse>(`/audit/summary?${summaryQuery}`),
			]);
			setPage(events);
			setSummary(counts);
		} catch (cause) {
			setError(cause);
		} finally {
			setRefreshing(false);
		}
	}, [listQuery, summaryQuery]);

	useEffect(() => {
		void load();
	}, [load]);

	function toggleSeverity(severity: AuditSeverity) {
		const selected = state.filters.severities ?? [];
		setState({
			...state,
			page: 1,
			filters: {
				...state.filters,
				severities: selected.includes(severity) ? selected.filter((entry) => entry !== severity) : [...selected, severity],
			},
		});
	}

	const columns = useMemo<DataTableColumn<AuditEventDto>[]>(
		() => [
			{
				id: "event",
				header: t("columns.event"),
				locked: true,
				sortable: false,
				flexible: true,
				cell: (event) => {
					const severity = SEVERITY_STYLES[event.severity];
					return (
						// One readable sentence, below it only severity and event type; the rest lives in the expanded row.
						<div className="flex min-w-0 items-stretch gap-3">
							<span aria-hidden="true" className={cn("w-1 shrink-0 rounded-full", severity.fill)} />
							<div className="flex min-w-0 flex-col gap-0.5 py-0.5">
								<span className="truncate text-sm font-medium">{textOf(event)}</span>
								<span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
									<span className={cn("shrink-0 font-medium", severity.text)}>{t(`severities.${event.severity}`)}</span>
									<span aria-hidden="true">·</span>
									<code className="truncate font-mono text-[11px]">{event.type}</code>
								</span>
							</div>
						</div>
					);
				},
			},
			{
				id: "actor",
				header: t("columns.actor"),
				sortable: false,
				width: "13rem",
				hideBelow: "md",
				cell: (event) => (
					<div className="flex min-w-0 items-center gap-2.5">
						<AuditActorAvatar event={event} size="sm" />
						<div className="flex min-w-0 flex-col">
							<span className="truncate text-sm">{actorOf(event).name}</span>
							<span className="truncate text-xs text-muted-foreground">{actorOf(event).role}</span>
						</div>
					</div>
				),
			},
			{
				id: "origin",
				header: t("columns.origin"),
				sortable: false,
				width: "11rem",
				hideBelow: "lg",
				cell: (event) => (
					<div className="flex min-w-0 flex-col">
						<span className="truncate text-sm">{deviceLabel(event.userAgent)}</span>
						<span className="truncate font-mono text-xs text-muted-foreground">{event.ipAddress ?? "–"}</span>
					</div>
				),
			},
			{
				id: "occurredAt",
				header: t("columns.occurredAt"),
				// The API orders chronologically; the header switches between newest and oldest first.
				value: (event) => new Date(event.occurredAt),
				align: "end",
				width: "10rem",
				cell: (event) => (
					<div className="flex flex-col items-end">
						<span className="text-sm whitespace-nowrap">{dates.relative(event.occurredAt)}</span>
						<time dateTime={event.occurredAt} className="text-xs whitespace-nowrap text-muted-foreground tabular-nums">
							{dates.dateTime(event.occurredAt)}
						</time>
					</div>
				),
			},
		],
		[t, dates, actorOf, textOf, deviceLabel],
	);

	const tableFilters = useMemo<DataTableFilter<AuditEventDto>[]>(
		() => [
			{
				id: "severities",
				label: t("filters.severities"),
				options: AUDIT_SEVERITIES.map((severity) => ({ value: severity, label: t(`severities.${severity}`) })),
			},
			{
				id: "categories",
				label: t("filters.categories"),
				options: AUDIT_CATEGORIES.map((category) => ({ value: category, label: t(`categories.${category}`) })),
			},
			{
				id: "outcomes",
				label: t("filters.outcomes"),
				options: AUDIT_OUTCOMES.map((outcome) => ({ value: outcome, label: t(`outcomes.${outcome}`) })),
			},
			{
				id: "sources",
				label: t("filters.sources"),
				options: AUDIT_SOURCES.map((source) => ({ value: source, label: t(`sources.${source}`) })),
			},
		],
		[t],
	);

	if (error) {
		return (
			<Page>
				<PageHeader title={t("title")} description={t("description")} />
				<ErrorState error={error} onRetry={() => void load()} />
			</Page>
		);
	}

	return (
		<Page>
			<PageHeader
				title={t("title")}
				description={t("description")}
				actions={
					summary ? (
						<AuditRetentionMenu
							days={summary.retentionDays}
							onChanged={(days) => setSummary((current) => (current ? { ...current, retentionDays: days } : current))}
						/>
					) : undefined
				}
			/>

			<DataTable
				label={t("title")}
				manual
				columns={columns}
				data={page?.events ?? []}
				total={page?.total ?? 0}
				getRowId={(event) => String(event.id)}
				loading={page === null}
				state={state}
				onStateChange={setState}
				filters={tableFilters}
				searchPlaceholder={t("searchPlaceholder")}
				pageSizeOptions={[...AUDIT_PAGE_SIZES]}
				renderExpanded={(event) => <AuditDetails event={event} />}
				emptyTitle={t("emptyTitle")}
				emptyDescription={t("emptyDescription")}
				header={<AuditSummaryBar summary={summary} selected={state.filters.severities ?? []} onToggle={toggleSeverity} />}
				toolbarActions={
					<>
						<ToggleGroup
							type="single"
							variant="outline"
							size="sm"
							value={String(rangeHours)}
							onValueChange={(value) => {
								if (!value) {
									return;
								}
								const hours = Number(value);
								setRangeHours(hours);
								setFrom(rangeStart(hours));
								setState((current) => ({ ...current, page: 1 }));
							}}
							className="max-sm:grid max-sm:min-w-0 max-sm:flex-1 max-sm:grid-cols-4 max-sm:*:h-9 max-sm:*:min-w-0 max-sm:*:px-1"
							aria-label={t("range.label")}
						>
							{AUDIT_RANGE_HOURS.map((hours) => (
								<ToggleGroupItem key={hours} value={String(hours)}>
									{t(`range.options.${hours}`)}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
						<Button
							type="button"
							variant="outline"
							size="icon-sm"
							className="max-sm:size-9"
							aria-label={t("refresh")}
							disabled={refreshing}
							onClick={() => void load()}
						>
							<RefreshCw className={refreshing ? "animate-spin" : undefined} />
						</Button>
					</>
				}
			/>

			{summary?.oldestAt ? (
				<p className="text-xs text-muted-foreground">{t("oldest", { date: dates.dateTime(summary.oldestAt) })}</p>
			) : null}
		</Page>
	);
}
