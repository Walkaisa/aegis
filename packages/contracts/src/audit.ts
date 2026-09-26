import { z } from "zod";
import type { IsoDateString } from "./common";
import type { Role } from "./roles";
import type { Snowflake } from "./snowflakes";

/** How much attention an event deserves; drives the colour of the audit log. */
export const AUDIT_SEVERITIES = ["info", "notice", "warning", "error", "critical"] as const;
export type AuditSeverity = (typeof AUDIT_SEVERITIES)[number];

export const AUDIT_OUTCOMES = ["success", "failure"] as const;
export type AuditOutcome = (typeof AUDIT_OUTCOMES)[number];

/** Where an event originated. */
export const AUDIT_SOURCES = ["admin", "user", "application", "system"] as const;
export type AuditSource = (typeof AUDIT_SOURCES)[number];

export const AUDIT_CATEGORIES = ["authentication", "users", "applications", "email", "system"] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_TARGET_TYPES = ["account", "session", "application", "instance", "signing_key", "message"] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

interface AuditEventSpec {
	category: AuditCategory;
	severity: AuditSeverity;
	outcome: AuditOutcome;
	/** Default source; a call site may override it (an admin sign-in versus a user sign-in). */
	source: AuditSource;
	target: AuditTargetType;
}

/**
 * Every event Aegis records, with the classification the audit log filters and colours by.
 * The key is the stored `event_type`; its dotted prefix also defines the category.
 */
export const AUDIT_EVENTS = {
	"setup.completed": { category: "system", severity: "notice", outcome: "success", source: "admin", target: "instance" },

	"auth.sign_in.succeeded": { category: "authentication", severity: "info", outcome: "success", source: "admin", target: "session" },
	"auth.sign_in.failed": { category: "authentication", severity: "warning", outcome: "failure", source: "admin", target: "session" },
	"auth.sign_out": { category: "authentication", severity: "info", outcome: "success", source: "admin", target: "session" },
	/** Someone asked for a password reset link. Recorded even when no account matches the address. */
	"auth.password_reset.requested": {
		category: "authentication",
		severity: "notice",
		outcome: "success",
		source: "user",
		target: "account",
	},
	"auth.password_reset.completed": {
		category: "authentication",
		severity: "warning",
		outcome: "success",
		source: "user",
		target: "account",
	},
	/** A reset link that was already used, has expired or never existed. */
	"auth.password_reset.failed": {
		category: "authentication",
		severity: "warning",
		outcome: "failure",
		source: "user",
		target: "account",
	},

	"user.created": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	"user.updated": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	"user.enabled": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	"user.disabled": { category: "users", severity: "warning", outcome: "success", source: "admin", target: "account" },
	"user.deleted": { category: "users", severity: "warning", outcome: "success", source: "admin", target: "account" },
	"user.password_reset": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	"user.password_changed": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	"user.role_changed": { category: "users", severity: "warning", outcome: "success", source: "admin", target: "account" },
	"user.avatar_updated": { category: "users", severity: "info", outcome: "success", source: "admin", target: "account" },
	"user.avatar_removed": { category: "users", severity: "info", outcome: "success", source: "admin", target: "account" },
	"user.two_factor_enabled": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	"user.two_factor_disabled": { category: "users", severity: "warning", outcome: "success", source: "admin", target: "account" },
	/** An admin turned two-factor authentication off for another account, e.g. after a lost device. */
	"user.two_factor_reset": { category: "users", severity: "warning", outcome: "success", source: "admin", target: "account" },
	"user.recovery_codes_regenerated": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	/** A new e-mail address was entered and a confirmation link sent to it. */
	"user.email_change_requested": { category: "users", severity: "notice", outcome: "success", source: "admin", target: "account" },
	"user.email_change_confirmed": { category: "users", severity: "notice", outcome: "success", source: "user", target: "account" },
	"user.email_change_cancelled": { category: "users", severity: "info", outcome: "success", source: "admin", target: "account" },
	/** A confirmation link that was already used, has expired or never existed. */
	"user.email_change_failed": { category: "users", severity: "warning", outcome: "failure", source: "user", target: "account" },

	"session.revoked": { category: "authentication", severity: "notice", outcome: "success", source: "admin", target: "session" },
	/** An admin ended the sessions of all accounts, the own one included. */
	"session.all_revoked": { category: "authentication", severity: "warning", outcome: "success", source: "admin", target: "session" },

	"client.created": { category: "applications", severity: "notice", outcome: "success", source: "admin", target: "application" },
	"client.updated": { category: "applications", severity: "notice", outcome: "success", source: "admin", target: "application" },
	"client.deleted": { category: "applications", severity: "warning", outcome: "success", source: "admin", target: "application" },
	"client.secret_rotated": { category: "applications", severity: "warning", outcome: "success", source: "admin", target: "application" },
	"client.sessions_revoked": { category: "applications", severity: "notice", outcome: "success", source: "admin", target: "application" },
	"client.session_revoked": { category: "applications", severity: "notice", outcome: "success", source: "admin", target: "session" },
	"client.logo_updated": { category: "applications", severity: "info", outcome: "success", source: "admin", target: "application" },
	"client.logo_removed": { category: "applications", severity: "info", outcome: "success", source: "admin", target: "application" },
	"client.user_assigned": { category: "applications", severity: "notice", outcome: "success", source: "admin", target: "application" },
	"client.user_unassigned": { category: "applications", severity: "notice", outcome: "success", source: "admin", target: "application" },

	"oidc.authorization.succeeded": {
		category: "applications",
		severity: "info",
		outcome: "success",
		source: "user",
		target: "application",
	},
	"oidc.authorization.failed": {
		category: "applications",
		severity: "warning",
		outcome: "failure",
		source: "application",
		target: "application",
	},
	"oidc.authorization.cancelled": {
		category: "applications",
		severity: "info",
		outcome: "success",
		source: "user",
		target: "application",
	},
	/** A signed-in account tried to use an application it may not sign in to. */
	"oidc.authorization.denied": {
		category: "applications",
		severity: "warning",
		outcome: "failure",
		source: "user",
		target: "application",
	},
	"oidc.consent.granted": { category: "applications", severity: "notice", outcome: "success", source: "user", target: "application" },
	"oidc.token.failed": { category: "applications", severity: "error", outcome: "failure", source: "application", target: "application" },
	"oidc.sign_out": { category: "applications", severity: "info", outcome: "success", source: "user", target: "session" },

	"email.sent": { category: "email", severity: "info", outcome: "success", source: "system", target: "message" },
	"email.failed": { category: "email", severity: "error", outcome: "failure", source: "system", target: "message" },
	"email.settings.updated": { category: "email", severity: "notice", outcome: "success", source: "admin", target: "instance" },
	"email.settings.enabled": { category: "email", severity: "notice", outcome: "success", source: "admin", target: "instance" },
	"email.settings.disabled": { category: "email", severity: "warning", outcome: "success", source: "admin", target: "instance" },
	"email.connection.tested": { category: "email", severity: "info", outcome: "success", source: "admin", target: "instance" },
	"email.connection.failed": { category: "email", severity: "warning", outcome: "failure", source: "admin", target: "instance" },

	"settings.updated": { category: "system", severity: "notice", outcome: "success", source: "admin", target: "instance" },
	"signing_key.rotated": { category: "system", severity: "warning", outcome: "success", source: "admin", target: "signing_key" },
} as const satisfies Record<string, AuditEventSpec>;

export type AuditEventType = keyof typeof AUDIT_EVENTS;

export const AUDIT_EVENT_TYPES = Object.keys(AUDIT_EVENTS) as AuditEventType[];

export function auditSpecOf(type: AuditEventType): AuditEventSpec {
	return AUDIT_EVENTS[type];
}

export function auditCategoryOf(type: AuditEventType): AuditCategory {
	return AUDIT_EVENTS[type].category;
}

export function auditTargetTypeOf(type: AuditEventType): AuditTargetType {
	return AUDIT_EVENTS[type].target;
}

export function auditOutcomeOf(type: AuditEventType): AuditOutcome {
	return AUDIT_EVENTS[type].outcome;
}

const SEVERITY_RANK: Record<AuditSeverity, number> = { info: 0, notice: 1, warning: 2, error: 3, critical: 4 };

export function maxAuditSeverity(left: AuditSeverity, right: AuditSeverity): AuditSeverity {
	return SEVERITY_RANK[left] >= SEVERITY_RANK[right] ? left : right;
}

export type AuditMetadataValue = string | number | boolean | null | string[];

/**
 * Severity of a concrete event. A few events escalate from their baseline: repeated failed
 * sign-ins are an attack signal, not routine noise.
 */
export function auditSeverityOf(type: AuditEventType, metadata?: Record<string, AuditMetadataValue> | null): AuditSeverity {
	const baseline = AUDIT_EVENTS[type].severity;
	if (type === "auth.sign_in.failed" && metadata?.reason === "throttled") {
		return maxAuditSeverity(baseline, "error");
	}
	// A recovery code stands in for a lost or unavailable authenticator; worth a second look.
	if (type === "auth.sign_in.succeeded" && metadata?.secondFactor === "recovery_code") {
		return maxAuditSeverity(baseline, "notice");
	}
	return baseline;
}

/** Event types belonging to any of the given categories; used to translate a category filter into SQL. */
export function auditEventTypesIn(categories: readonly AuditCategory[]): AuditEventType[] {
	const wanted = new Set<AuditCategory>(categories);
	return AUDIT_EVENT_TYPES.filter((type) => wanted.has(AUDIT_EVENTS[type].category));
}

export interface AuditReferenceDto {
	/** `null` once the referenced account or application has been deleted. */
	id: Snowflake | null;
	/** The email address or application name at the time of the event. */
	label: string | null;
	/** Current display name of the account or name of the application; `null` once it has been deleted. */
	name: string | null;
	/** Current role of a referenced account; `null` for applications and deleted accounts. */
	role: Role | null;
	/** Current profile picture of the account or logo of the application, if it still exists and has one. */
	imageUrl: string | null;
}

export interface AuditEventDto {
	id: Snowflake;
	type: AuditEventType;
	category: AuditCategory;
	severity: AuditSeverity;
	outcome: AuditOutcome;
	source: AuditSource;
	targetType: AuditTargetType;
	occurredAt: IsoDateString;
	actor: AuditReferenceDto | null;
	subject: AuditReferenceDto | null;
	client: AuditReferenceDto | null;
	ipAddress: string | null;
	userAgent: string | null;
	metadata: Record<string, AuditMetadataValue>;
}

export const AUDIT_PAGE_SIZES = [25, 50, 100] as const;
export const AUDIT_DEFAULT_PAGE_SIZE = 25;
export const AUDIT_SEARCH_MAX_LENGTH = 200;

/** Query parameters arrive as comma-separated lists, e.g. `severities=warning,error`. */
function commaSeparated<T extends string>(values: readonly T[]) {
	return z.preprocess(
		(value) => (typeof value === "string" ? value.split(",").filter((entry) => entry.length > 0) : (value ?? [])),
		z.array(z.enum(values as unknown as [T, ...T[]], { error: "invalid" })),
	);
}

export const auditQuerySchema = z.object({
	page: z.coerce.number({ error: "invalid" }).int({ error: "invalid" }).min(1, { error: "out_of_range" }).default(1),
	perPage: z.coerce
		.number({ error: "invalid" })
		.int({ error: "invalid" })
		.min(1, { error: "out_of_range" })
		.max(200, { error: "out_of_range" })
		.default(AUDIT_DEFAULT_PAGE_SIZE),
	categories: commaSeparated(AUDIT_CATEGORIES),
	severities: commaSeparated(AUDIT_SEVERITIES),
	outcomes: commaSeparated(AUDIT_OUTCOMES),
	sources: commaSeparated(AUDIT_SOURCES),
	from: z.iso.datetime({ offset: true, error: "invalid" }).nullish().default(null),
	to: z.iso.datetime({ offset: true, error: "invalid" }).nullish().default(null),
	search: z.string({ error: "invalid" }).trim().max(AUDIT_SEARCH_MAX_LENGTH, { error: "too_long" }).default(""),
	/** The log is chronological; the only choice is which end to start from. */
	order: z.enum(["newest", "oldest"], { error: "invalid" }).default("newest"),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;

export interface AuditPageResponse {
	events: AuditEventDto[];
	total: number;
	page: number;
	perPage: number;
}

export interface AuditSummaryResponse {
	total: number;
	bySeverity: Record<AuditSeverity, number>;
	oldestAt: IsoDateString | null;
	newestAt: IsoDateString | null;
	/** How long entries are kept before the maintenance run removes them. */
	retentionDays: number;
}
