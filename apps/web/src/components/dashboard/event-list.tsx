"use client";

import type { AuditEventDto } from "@aegis/contracts";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useMemo } from "react";
import { AuditActorAvatar, AuditEventIcon, isHighlighted, referenceName, useAuditTitle } from "@/components/audit/audit-event";
import { SEVERITY_STYLES } from "@/components/audit/audit-tokens";
import { DeviceIcon, useDeviceLabel } from "@/components/dashboard/device";
import { UserAvatar } from "@/components/users/account-badges";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Identifies the local calendar day of a timestamp. */
function dayKey(date: Date): string {
	return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** "Today", "Yesterday" or the date, for the headings between the days of the feed. */
function useDayLabel() {
	const locale = useLocale();

	return useMemo(() => {
		const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
		const long = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long" });

		return (date: Date) => {
			const today = new Date();
			const days = Math.round((new Date(today.toDateString()).getTime() - new Date(date.toDateString()).getTime()) / DAY_MS);
			const label = days <= 1 ? relative.format(-days, "day") : long.format(date);
			return label.charAt(0).toLocaleUpperCase(locale) + label.slice(1);
		};
	}, [locale]);
}

/** A small label below an event; the feed packs its details into these instead of a line of text. */
function Chip({ children, className }: { children: ReactNode; className?: string }) {
	return (
		<span
			className={cn(
				"inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 truncate rounded-md bg-muted/60 px-2 text-xs text-muted-foreground [&_svg]:size-3.5 [&_svg]:shrink-0",
				className,
			)}
		>
			{children}
		</span>
	);
}

/**
 * Compact, read-only activity feed grouped by day, laid out like a chat: who did what, the time on
 * the right and a few chips with who else was involved and from which device. Only events that need
 * attention say why, in their severity colour. The full record lives under /audit.
 */
export function EventList({ events }: { events: AuditEventDto[] }) {
	const t = useTranslations("audit");
	const dates = useDateFormat();
	const titleOf = useAuditTitle();
	const dayLabel = useDayLabel();
	const deviceLabel = useDeviceLabel();

	const days = useMemo(() => {
		const groups: { key: string; label: string; today: boolean; events: AuditEventDto[] }[] = [];
		const today = dayKey(new Date());
		for (const event of events) {
			const date = new Date(event.occurredAt);
			const key = dayKey(date);
			const group = groups.at(-1);
			if (group?.key === key) {
				group.events.push(event);
			} else {
				groups.push({ key, label: dayLabel(date), today: key === today, events: [event] });
			}
		}
		return groups;
	}, [events, dayLabel]);

	return (
		<div className="flex flex-col gap-5">
			{days.map((day) => (
				<section key={day.key} aria-label={day.label} className="flex flex-col gap-1">
					<h3 className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
						{day.label}
						<span aria-hidden="true" className="h-px flex-1 bg-border" />
					</h3>
					<ol className="flex flex-col">
						{day.events.map((event, index) => {
							const reason =
								typeof event.metadata.reason === "string" && t.has(`reasons.${event.metadata.reason}`)
									? t(`reasons.${event.metadata.reason}`)
									: null;
							// Only named when the sentence does not already say who it was.
							const actor = event.actor && event.actor.id !== event.subject?.id ? referenceName(event.actor) : null;
							const highlighted = isHighlighted(event.severity);
							const severity = SEVERITY_STYLES[event.severity];
							const last = index === day.events.length - 1;

							return (
								<li key={event.id} className="relative flex gap-3.5 py-2.5">
									{last ? null : (
										<span
											aria-hidden="true"
											className="absolute top-12 -bottom-1 left-4 w-px -translate-x-1/2 bg-border"
										/>
									)}
									<span className="relative h-fit shrink-0">
										<AuditActorAvatar event={event} />
										<span className="absolute -right-1.5 -bottom-1 flex rounded-full bg-card p-0.5">
											<AuditEventIcon event={event} className="size-4 rounded-full" />
										</span>
									</span>
									<div className="flex min-w-0 flex-1 flex-col gap-1.5">
										<div className="flex min-w-0 items-baseline justify-between gap-4">
											<p className="min-w-0 text-sm leading-5 text-muted-foreground">{titleOf(event)}</p>
											<time
												dateTime={event.occurredAt}
												title={dates.dateTime(event.occurredAt)}
												className="shrink-0 text-xs text-muted-foreground tabular-nums"
											>
												{dates.time(event.occurredAt)}
											</time>
										</div>
										<div className="flex flex-wrap items-center gap-1.5">
											{highlighted ? (
												<Chip className={cn("font-medium ring-1 ring-inset", severity.surface)}>
													<span aria-hidden="true" className={cn("size-1.5 rounded-full", severity.fill)} />
													{reason ?? t(`severities.${event.severity}`)}
												</Chip>
											) : null}
											{actor ? (
												<Chip>
													<UserAvatar
														name={actor}
														src={event.actor?.imageUrl}
														size="sm-round"
														className="size-4 *:text-[8px]"
													/>
													{t("byActor", { actor })}
												</Chip>
											) : null}
											{event.userAgent ? (
												<Chip>
													<DeviceIcon userAgent={event.userAgent} />
													{deviceLabel(event.userAgent)}
												</Chip>
											) : null}
											{day.today ? (
												<span className="px-1 text-xs text-muted-foreground/70">
													{dates.relative(event.occurredAt)}
												</span>
											) : null}
										</div>
									</div>
								</li>
							);
						})}
					</ol>
				</section>
			))}
		</div>
	);
}
