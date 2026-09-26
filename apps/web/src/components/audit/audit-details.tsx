"use client";

import type { AuditEventDto, AuditReferenceDto } from "@aegis/contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppAvatar } from "@/components/app-avatar";
import { CopyButton } from "@/components/copy-button";
import { useDeviceLabel } from "@/components/dashboard/device";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/users/account-badges";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { referenceName, SeverityBadge } from "./audit-event";
import { CATEGORY_ICONS, OUTCOME_STYLES, SOURCE_ICONS, TARGET_ICONS } from "./audit-tokens";

function Panel({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
	return (
		<section className={cn("flex min-w-0 flex-col rounded-lg border bg-card", className)}>
			<h4 className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">{title}</h4>
			<dl className="flex flex-col divide-y px-4">{children}</dl>
		</section>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="grid min-h-10 grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-4 py-2">
			<dt className="min-w-0 text-xs break-words text-muted-foreground">{label}</dt>
			<dd className="flex min-w-0 items-center justify-end gap-1.5 text-right text-sm [overflow-wrap:anywhere] [&>svg]:shrink-0">
				{children}
			</dd>
		</div>
	);
}

/**
 * An account or application: picture and name, a link as long as it still exists. The email
 * address of an account shows in a tooltip, which keeps the narrow panel uncluttered.
 */
function Reference({ reference, kind }: { reference: AuditReferenceDto; kind: "account" | "application" }) {
	const t = useTranslations("audit");
	const label = referenceName(reference) ?? t("details.unknown");
	const email = kind === "account" ? reference.label : null;
	const href = reference.id ? (kind === "application" ? `/applications/${reference.id}` : `/users/${reference.id}`) : null;

	const content = (
		<>
			{kind === "application" ? (
				<AppAvatar name={label} src={reference.imageUrl} size="xs" />
			) : (
				<UserAvatar name={label} src={reference.imageUrl} size="sm-round" className="size-5 *:text-[9px]" />
			)}
			<span className="truncate">{label}</span>
		</>
	);

	const element = href ? (
		<Link
			href={href}
			className="-mx-1.5 inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
		>
			{content}
		</Link>
	) : (
		<span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">{content}</span>
	);

	if (!email) {
		return element;
	}
	return (
		<Tooltip>
			<TooltipTrigger asChild>{element}</TooltipTrigger>
			<TooltipContent>{email}</TooltipContent>
		</Tooltip>
	);
}

/** Everything Aegis recorded about a single event, revealed when its row is expanded. */
export function AuditDetails({ event }: { event: AuditEventDto }) {
	const t = useTranslations("audit");
	const dates = useDateFormat();
	const deviceLabel = useDeviceLabel();

	const outcome = OUTCOME_STYLES[event.outcome];
	const OutcomeIcon = outcome.icon;
	const CategoryIcon = CATEGORY_ICONS[event.category];
	const SourceIcon = SOURCE_ICONS[event.source];
	const TargetIcon = TARGET_ICONS[event.targetType];
	const metadata = Object.entries(event.metadata);
	const unknown = <span className="text-muted-foreground">{t("details.unknown")}</span>;

	return (
		<div className="grid gap-3 lg:grid-cols-3">
			<Panel title={t("details.event")}>
				<Row label={t("details.occurredAt")}>
					<time dateTime={event.occurredAt} className="tabular-nums">
						{dates.dateTime(event.occurredAt)}
					</time>
				</Row>
				<Row label={t("details.severity")}>
					<SeverityBadge severity={event.severity} />
				</Row>
				<Row label={t("details.outcome")}>
					<span className={cn("inline-flex items-center gap-1.5 font-medium", outcome.text)}>
						<OutcomeIcon className="size-3.5" />
						{t(`outcomes.${event.outcome}`)}
					</span>
				</Row>
				<Row label={t("details.category")}>
					<CategoryIcon className="size-3.5 text-muted-foreground" />
					{t(`categories.${event.category}`)}
				</Row>
				<Row label={t("details.eventType")}>
					<code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{event.type}</code>
				</Row>
			</Panel>

			<Panel title={t("details.people")}>
				<Row label={t("details.source")}>
					<SourceIcon className="size-3.5 text-muted-foreground" />
					{t(`sources.${event.source}`)}
				</Row>
				<Row label={t("details.actor")}>{event.actor ? <Reference reference={event.actor} kind="account" /> : unknown}</Row>
				{event.subject ? (
					<Row label={t("details.subject")}>
						<Reference reference={event.subject} kind="account" />
					</Row>
				) : null}
				{event.client ? (
					<Row label={t("details.application")}>
						<Reference reference={event.client} kind="application" />
					</Row>
				) : null}
				<Row label={t("details.target")}>
					<TargetIcon className="size-3.5 text-muted-foreground" />
					{t(`targets.${event.targetType}`)}
				</Row>
			</Panel>

			<Panel title={t("details.context")}>
				<Row label={t("details.ipAddress")}>
					{event.ipAddress ? (
						<>
							<code className="min-w-0 truncate font-mono text-xs" title={event.ipAddress}>
								{event.ipAddress}
							</code>
							<CopyButton value={event.ipAddress} size="icon-xs" />
						</>
					) : (
						unknown
					)}
				</Row>
				<Row label={t("details.client")}>
					<span className="truncate" title={event.userAgent ?? undefined}>
						{deviceLabel(event.userAgent)}
					</span>
				</Row>
				{metadata.map(([key, value]) => (
					<Row key={key} label={t.has(`fields.${key}`) ? t(`fields.${key}`) : key}>
						{value === null ? (
							unknown
						) : typeof value === "number" ? (
							<span className="tabular-nums">{value}</span>
						) : typeof value === "boolean" ? (
							<span>{value ? t("details.yes") : t("details.no")}</span>
						) : key === "template" && t.has(`templates.${value}`) ? (
							// The identifier of an e-mail template reads as the message it stands for.
							<span>{t(`templates.${value}`)}</span>
						) : (
							<code className="min-w-0 truncate font-mono text-xs" title={Array.isArray(value) ? value.join(", ") : value}>
								{Array.isArray(value) ? value.join(", ") : value}
							</code>
						)}
					</Row>
				))}
			</Panel>
		</div>
	);
}
