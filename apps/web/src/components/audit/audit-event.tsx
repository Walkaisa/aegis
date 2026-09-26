"use client";

import type { AuditEventDto, AuditReferenceDto, AuditSeverity } from "@aegis/contracts";
import { useTranslations } from "next-intl";
import { type ReactNode, useCallback } from "react";
import { AppAvatar } from "@/components/app-avatar";
import { UserAvatar } from "@/components/users/account-badges";
import { cn } from "@/lib/utils";
import { CATEGORY_ICONS, CATEGORY_SURFACES, SEVERITY_STYLES, SOURCE_ICONS } from "./audit-tokens";

/**
 * Placeholders the event message is formatted with, so the names can be emphasized afterwards.
 * The marker is a private-use character, which never occurs in a translated message or a name.
 */
const MARK = String.fromCharCode(0xe000);
const MARKERS = {
	client: `${MARK}client${MARK}`,
	subject: `${MARK}subject${MARK}`,
	recipient: `${MARK}recipient${MARK}`,
} as const;
const MARKER_PATTERN = new RegExp(`${MARK}(client|subject|recipient)${MARK}`);

/** Display name of an account or name of an application, falling back to the label stored with the event. */
export function referenceName(reference: AuditReferenceDto | null): string | null {
	return reference?.name ?? reference?.label ?? null;
}

/** The names an event message is formatted with. */
function useEventNames() {
	const t = useTranslations("audit");
	return useCallback(
		(event: AuditEventDto) => ({
			client: referenceName(event.client) ?? t("unknownApplication"),
			subject: referenceName(event.subject) ?? t("unknownAccount"),
			// Messages are addressed to a mailbox, which may not belong to an account at all.
			recipient: typeof event.metadata.recipient === "string" ? event.metadata.recipient : t("unknownRecipient"),
		}),
		[t],
	);
}

/** The message of an event as plain text, e.g. "Sebastian signed in to Test App". */
export function useAuditText() {
	const t = useTranslations("audit");
	const namesOf = useEventNames();
	return useCallback((event: AuditEventDto) => t(`events.${event.type}`, namesOf(event)), [t, namesOf]);
}

/** Routine events stay calm; only these get their severity colour. */
export function isHighlighted(severity: AuditSeverity): boolean {
	return severity !== "info" && severity !== "notice";
}

/** The message of an event with the account and application names set off from the sentence. */
export function useAuditTitle() {
	const t = useTranslations("audit");
	const namesOf = useEventNames();

	return useCallback(
		(event: AuditEventDto): ReactNode => {
			const names = namesOf(event);
			const parts = t(`events.${event.type}`, MARKERS).split(MARKER_PATTERN);
			return parts.map((part, index) =>
				index % 2 === 1 ? (
					// biome-ignore lint/suspicious/noArrayIndexKey: the parts of a sentence never reorder
					<span key={index} className="font-medium text-foreground">
						{names[part as keyof typeof names]}
					</span>
				) : (
					part
				),
			);
		},
		[t, namesOf],
	);
}

export interface AuditActor {
	name: string;
	kind: "account" | "application" | "anonymous";
	/** "Admin" or "User" for an existing account, otherwise where the event came from. */
	role: string;
	imageUrl: string | null;
}

/** Who triggered an event: an account, an application or Aegis itself. */
export function useAuditActor() {
	const t = useTranslations("audit");
	const tRoles = useTranslations("roles");

	return useCallback(
		(event: AuditEventDto): AuditActor => {
			const source = t(`sources.${event.source}`);
			const account = (reference: AuditReferenceDto, name: string): AuditActor => ({
				name,
				kind: "account",
				role: reference.role ? tRoles(reference.role) : source,
				imageUrl: reference.imageUrl,
			});

			const actorName = referenceName(event.actor);
			if (event.actor && actorName) {
				return account(event.actor, actorName);
			}
			const clientName = referenceName(event.client);
			if (event.source === "application" && clientName) {
				return { name: clientName, kind: "application", role: source, imageUrl: event.client?.imageUrl ?? null };
			}
			const subjectName = referenceName(event.subject);
			if (event.source === "user" && event.subject && subjectName) {
				return account(event.subject, subjectName);
			}
			const email = typeof event.metadata.email === "string" ? event.metadata.email : null;
			return { name: email ?? source, kind: "anonymous", role: source, imageUrl: null };
		},
		[t, tRoles],
	);
}

const ACTOR_SIZES = {
	sm: { avatar: "size-6", icon: "size-3.5" },
	md: { avatar: "size-8", icon: "size-4" },
} as const;

/** Picture of whoever triggered the event; a neutral source icon when nobody is known. */
export function AuditActorAvatar({ event, size = "md", className }: { event: AuditEventDto; size?: "sm" | "md"; className?: string }) {
	const actorOf = useAuditActor();
	const actor = actorOf(event);
	const style = ACTOR_SIZES[size];

	if (actor.kind === "application") {
		return <AppAvatar name={actor.name} src={actor.imageUrl} size="sm" className={cn(style.avatar, className)} />;
	}
	if (actor.kind === "account") {
		return <UserAvatar name={actor.name} src={actor.imageUrl} size="sm-round" className={cn(style.avatar, className)} />;
	}
	const Icon = SOURCE_ICONS[event.source];
	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border ring-inset",
				style.avatar,
				className,
			)}
		>
			<Icon className={style.icon} />
		</span>
	);
}

/** Square icon for an event: tinted by its category, or by its severity when it needs attention. */
export function AuditEventIcon({ event, className }: { event: AuditEventDto; className?: string }) {
	const highlighted = isHighlighted(event.severity);
	const Icon = highlighted ? SEVERITY_STYLES[event.severity].icon : CATEGORY_ICONS[event.category];

	return (
		<span
			aria-hidden="true"
			className={cn(
				"flex shrink-0 items-center justify-center ring-1 ring-inset",
				highlighted ? SEVERITY_STYLES[event.severity].surface : CATEGORY_SURFACES[event.category],
				className,
			)}
		>
			<Icon className="size-[55%]" />
		</span>
	);
}

/** Square icon for a severity: one fixed icon and colour per level. */
export function SeverityIcon({ severity, className }: { severity: AuditSeverity; className?: string }) {
	const style = SEVERITY_STYLES[severity];
	const Icon = style.icon;

	return (
		<span aria-hidden="true" className={cn("flex shrink-0 items-center justify-center ring-1 ring-inset", style.surface, className)}>
			<Icon className="size-[45%]" />
		</span>
	);
}

/** Pill with a coloured dot; routine severities stay muted. */
export function SeverityBadge({ severity, className }: { severity: AuditSeverity; className?: string }) {
	const t = useTranslations("audit");
	const style = SEVERITY_STYLES[severity];
	const highlighted = isHighlighted(severity);

	return (
		<span
			className={cn(
				"inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
				highlighted ? style.surface : "bg-muted/60 text-muted-foreground ring-border",
				className,
			)}
		>
			<span aria-hidden="true" className={cn("size-1.5 rounded-full", style.fill)} />
			{t(`severities.${severity}`)}
		</span>
	);
}
