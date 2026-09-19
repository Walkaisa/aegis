"use client";

import { AUDIT_SEVERITIES, type AuditSeverity, type AuditSummaryResponse } from "@aegis/contracts";
import { useFormatter, useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { SEVERITY_STYLES } from "./audit-tokens";

/**
 * How the matching entries split across severities: a total, a proportional bar and one chip per
 * severity. Clicking a chip filters the log down to it.
 */
export function AuditSummaryBar({
	summary,
	selected,
	onToggle,
}: {
	summary: AuditSummaryResponse | undefined;
	selected: string[];
	onToggle: (severity: AuditSeverity) => void;
}) {
	const t = useTranslations("audit");
	const format = useFormatter();

	if (!summary) {
		return <Skeleton className="h-[6.5rem] rounded-xl" />;
	}

	return (
		<div className="flex flex-col gap-4 rounded-xl border bg-card p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<p className="flex items-baseline gap-2">
					<span className="text-2xl font-semibold tracking-tight tabular-nums">{format.number(summary.total)}</span>
					<span className="text-sm text-muted-foreground">{t("summary.entries", { count: summary.total })}</span>
				</p>
				<p className="text-xs text-muted-foreground">{t("summary.hint")}</p>
			</div>

			<div aria-hidden="true" className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
				{summary.total > 0
					? AUDIT_SEVERITIES.map((severity) => {
							const value = summary.bySeverity[severity] ?? 0;
							return value > 0 ? (
								<span
									key={severity}
									className={cn(
										"h-full transition-[width,opacity] duration-500 ease-out",
										SEVERITY_STYLES[severity].fill,
										selected.length > 0 && !selected.includes(severity) && "opacity-25",
									)}
									style={{ width: `${(value / summary.total) * 100}%` }}
								/>
							) : null;
						})
					: null}
			</div>

			<div className="flex flex-wrap gap-2">
				{AUDIT_SEVERITIES.map((severity) => {
					const active = selected.includes(severity);
					const value = summary.bySeverity[severity] ?? 0;

					return (
						<button
							key={severity}
							type="button"
							aria-pressed={active}
							onClick={() => onToggle(severity)}
							className={cn(
								"inline-flex h-7 cursor-pointer items-center gap-2 rounded-full border px-3 text-xs transition-colors outline-none",
								"hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50",
								active ? "border-foreground/30 bg-muted text-foreground" : "text-muted-foreground",
								value === 0 && !active && "opacity-60",
							)}
						>
							<span aria-hidden="true" className={cn("size-2 rounded-full", SEVERITY_STYLES[severity].fill)} />
							{t(`severities.${severity}`)}
							<span className="font-medium text-foreground tabular-nums">{format.number(value)}</span>
						</button>
					);
				})}
			</div>
		</div>
	);
}
