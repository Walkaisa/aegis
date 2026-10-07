"use client";

import type { AuditEventDto, AuditReferenceDto } from "@aegis/contracts";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AppAvatar } from "@/components/app-avatar";
import { CopyButton } from "@/components/copy-button";
import {
	DetailSheet,
	DetailSheetBody,
	DetailSheetFact,
	DetailSheetFacts,
	DetailSheetHeader,
	DetailSheetRaw,
	DetailSheetSection,
} from "@/components/dashboard/detail-sheet";
import { useDeviceLabel } from "@/components/dashboard/device";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { UserAvatar } from "@/components/users/account-badges";
import { useDateFormat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { referenceName, SeverityBadge, SeverityIcon, useAuditText } from "./audit-event";
import { CATEGORY_ICONS, OUTCOME_STYLES, SOURCE_ICONS, TARGET_ICONS } from "./audit-tokens";

/**
 * An account or application: picture and name, a link as long as it still exists. The email
 * address of an account shows in a tooltip, which keeps the row uncluttered.
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
			className="-mx-1.5 inline-flex min-w-0 items-center gap-2 rounded-md px-1.5 py-0.5 transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
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

/** Everything Aegis recorded about a single event, in a side panel. */
export function AuditSheet({ event, onClose }: { event: AuditEventDto | null; onClose: () => void }) {
	return (
		<DetailSheet item={event} onClose={onClose}>
			{(shown) => <AuditPanel event={shown} />}
		</DetailSheet>
	);
}

function AuditPanel({ event }: { event: AuditEventDto }) {
	const t = useTranslations("audit");
	const dates = useDateFormat();
	const deviceLabel = useDeviceLabel();
	const textOf = useAuditText();

	const outcome = OUTCOME_STYLES[event.outcome];
	const OutcomeIcon = outcome.icon;
	const CategoryIcon = CATEGORY_ICONS[event.category];
	const SourceIcon = SOURCE_ICONS[event.source];
	const TargetIcon = TARGET_ICONS[event.targetType];
	const metadata = Object.entries(event.metadata);
	const unknown = <span className="font-normal text-muted-foreground">{t("details.unknown")}</span>;

	return (
		<>
			<DetailSheetHeader
				icon={<SeverityIcon severity={event.severity} className="size-10 rounded-xl" />}
				title={textOf(event)}
				description={
					<>
						<time dateTime={event.occurredAt} title={dates.dateTime(event.occurredAt)}>
							{dates.relative(event.occurredAt)}
						</time>
						<SeverityBadge severity={event.severity} />
					</>
				}
			/>

			<DetailSheetBody>
				<DetailSheetSection title={t("details.event")}>
					<DetailSheetFacts>
						<DetailSheetFact label={t("details.occurredAt")}>
							<time dateTime={event.occurredAt} className="tabular-nums">
								{dates.dateTime(event.occurredAt)}
							</time>
						</DetailSheetFact>
						<DetailSheetFact label={t("details.outcome")}>
							<span className={cn("inline-flex items-center gap-1.5", outcome.text)}>
								<OutcomeIcon className="size-3.5" />
								{t(`outcomes.${event.outcome}`)}
							</span>
						</DetailSheetFact>
						<DetailSheetFact label={t("details.category")}>
							<CategoryIcon className="size-3.5 text-muted-foreground" />
							{t(`categories.${event.category}`)}
						</DetailSheetFact>
						<DetailSheetFact label={t("details.eventType")}>
							<code className="truncate rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-normal">{event.type}</code>
						</DetailSheetFact>
					</DetailSheetFacts>
				</DetailSheetSection>

				<DetailSheetSection title={t("details.people")}>
					<DetailSheetFacts>
						<DetailSheetFact label={t("details.source")}>
							<SourceIcon className="size-3.5 text-muted-foreground" />
							{t(`sources.${event.source}`)}
						</DetailSheetFact>
						<DetailSheetFact label={t("details.actor")}>
							{event.actor ? <Reference reference={event.actor} kind="account" /> : unknown}
						</DetailSheetFact>
						{event.subject ? (
							<DetailSheetFact label={t("details.subject")}>
								<Reference reference={event.subject} kind="account" />
							</DetailSheetFact>
						) : null}
						{event.client ? (
							<DetailSheetFact label={t("details.application")}>
								<Reference reference={event.client} kind="application" />
							</DetailSheetFact>
						) : null}
						<DetailSheetFact label={t("details.target")}>
							<TargetIcon className="size-3.5 text-muted-foreground" />
							{t(`targets.${event.targetType}`)}
						</DetailSheetFact>
					</DetailSheetFacts>
				</DetailSheetSection>

				<DetailSheetSection title={t("details.context")}>
					<DetailSheetFacts>
						<DetailSheetFact label={t("details.ipAddress")}>
							{event.ipAddress ? (
								<>
									<code className="min-w-0 font-mono text-xs break-all">{event.ipAddress}</code>
									<CopyButton value={event.ipAddress} size="icon-xs" />
								</>
							) : (
								unknown
							)}
						</DetailSheetFact>
						<DetailSheetFact label={t("details.client")}>{deviceLabel(event.userAgent)}</DetailSheetFact>
						{metadata.map(([key, value]) => (
							<DetailSheetFact key={key} label={t.has(`fields.${key}`) ? t(`fields.${key}`) : key}>
								{value === null ? (
									unknown
								) : typeof value === "number" ? (
									<span className="tabular-nums">{value}</span>
								) : typeof value === "boolean" ? (
									value ? (
										t("details.yes")
									) : (
										t("details.no")
									)
								) : key === "template" && t.has(`templates.${value}`) ? (
									// The identifier of an e-mail template reads as the message it stands for.
									t(`templates.${value}`)
								) : (
									<code className="min-w-0 font-mono text-xs font-normal break-all">
										{Array.isArray(value) ? value.join(", ") : value}
									</code>
								)}
							</DetailSheetFact>
						))}
					</DetailSheetFacts>
					{event.userAgent ? <DetailSheetRaw>{event.userAgent}</DetailSheetRaw> : null}
				</DetailSheetSection>
			</DetailSheetBody>
		</>
	);
}
