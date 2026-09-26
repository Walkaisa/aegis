import {
	AUDIT_SEVERITIES,
	type AuditEventDto,
	type AuditEventType,
	type AuditMetadataValue,
	type AuditOutcome,
	type AuditPageResponse,
	type AuditQuery,
	type AuditReferenceDto,
	type AuditSeverity,
	type AuditSource,
	type AuditSummaryResponse,
	applicationLogoUrl,
	auditCategoryOf,
	auditEventTypesIn,
	auditOutcomeOf,
	auditSeverityOf,
	auditSpecOf,
	auditTargetTypeOf,
	avatarUrl,
	type Role,
} from "@aegis/contracts";
import { auditEvents, oidcClients, users } from "@aegis/db";
import { and, asc, count, desc, eq, gte, ilike, inArray, isNotNull, isNull, lte, max, min, or, type SQL, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "../db/database.js";
import { newId } from "../lib/snowflakes.js";
import { toIso, toIsoOrNull } from "../lib/time.js";

/** An account or application referenced by an audit event, with a label that outlives it. */
export interface AuditReference {
	id: string;
	label: string;
}

export interface AuditRecordInput {
	type: AuditEventType;
	actor?: AuditReference | null;
	subject?: AuditReference | null;
	client?: AuditReference | null;
	/** Overrides the default source of the event type, e.g. a user signing in instead of an admin. */
	source?: AuditSource;
	meta?: { ip: string | null; userAgent: string | null };
	/** Never put secrets (passwords, tokens, client secrets) here. */
	metadata?: Record<string, AuditMetadataValue>;
}

const actors = alias(users, "audit_actors");
const subjects = alias(users, "audit_subjects");

/** An event with the current names, types and pictures of the accounts and the application it references. */
const eventWithReferences = {
	event: auditEvents,
	actor: { name: actors.displayName, role: actors.role, avatarHash: actors.avatarHash },
	subject: { name: subjects.displayName, role: subjects.role, avatarHash: subjects.avatarHash },
	client: { name: oidcClients.name, logoHash: oidcClients.logoHash },
};

interface AccountDetails {
	name: string;
	role: Role;
	avatarHash: string | null;
}

interface AuditEventRow {
	event: typeof auditEvents.$inferSelect;
	actor: AccountDetails | null;
	subject: AccountDetails | null;
	client: { name: string; logoHash: string | null } | null;
}

function accountReference(id: string | null, label: string | null, account: AccountDetails | null): AuditReferenceDto | null {
	if (!id && !label) {
		return null;
	}
	return {
		id,
		label,
		name: account?.name ?? null,
		role: account?.role ?? null,
		imageUrl: id && account ? avatarUrl(id, account.avatarHash) : null,
	};
}

function clientReference(id: string | null, label: string | null, client: AuditEventRow["client"]): AuditReferenceDto | null {
	if (!id && !label) {
		return null;
	}
	return {
		id,
		label,
		name: client?.name ?? null,
		role: null,
		imageUrl: id && client ? applicationLogoUrl(id, client.logoHash) : null,
	};
}

/** Escapes the LIKE wildcards so a search term is matched literally. */
function escapeLike(value: string): string {
	return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

/**
 * Translates the filters of the audit log into SQL. A category filter becomes the set of event
 * types in those categories, because the category is derived from the event type.
 */
function conditions(
	query: Pick<AuditQuery, "categories" | "severities" | "outcomes" | "sources" | "from" | "to" | "search">,
): SQL | undefined {
	const clauses: SQL[] = [];

	if (query.categories.length > 0) {
		const types = auditEventTypesIn(query.categories);
		clauses.push(types.length > 0 ? inArray(auditEvents.eventType, types) : sql`false`);
	}
	if (query.severities.length > 0) {
		clauses.push(inArray(auditEvents.severity, query.severities));
	}
	if (query.outcomes.length > 0) {
		clauses.push(inArray(auditEvents.outcome, query.outcomes));
	}
	if (query.sources.length > 0) {
		clauses.push(inArray(auditEvents.source, query.sources));
	}
	if (query.from) {
		clauses.push(gte(auditEvents.occurredAt, new Date(query.from)));
	}
	if (query.to) {
		clauses.push(lte(auditEvents.occurredAt, new Date(query.to)));
	}
	if (query.search.length > 0) {
		const pattern = `%${escapeLike(query.search)}%`;
		const match = or(
			ilike(auditEvents.eventType, pattern),
			ilike(auditEvents.actorLabel, pattern),
			ilike(auditEvents.subjectLabel, pattern),
			ilike(auditEvents.clientLabel, pattern),
			ilike(auditEvents.ipAddress, pattern),
		);
		if (match) {
			clauses.push(match);
		}
	}

	return clauses.length > 0 ? and(...clauses) : undefined;
}

/**
 * Sign-in activity: signing in to Aegis itself and to applications, including single sign-on with an
 * existing session. A password sign-in on the way to an application is followed by its authorization,
 * so only the authorization counts. Failures are rejected sign-ins and accounts denied an application;
 * protocol errors (`oidc.authorization.failed`) are configuration problems, not sign-in attempts.
 */
const signInActivity = or(
	and(eq(auditEvents.eventType, "auth.sign_in.succeeded"), sql`${auditEvents.metadata} ->> 'context' IS DISTINCT FROM 'oidc'`),
	inArray(auditEvents.eventType, ["auth.sign_in.failed", "oidc.authorization.succeeded", "oidc.authorization.denied"]),
);

/** Leaves out events of applications that have been deleted since; the audit log itself keeps them. */
const withoutDeletedClients = or(isNotNull(auditEvents.clientId), isNull(auditEvents.clientLabel));

/** Append-only audit trail. */
export class AuditLog {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	public async record(input: AuditRecordInput, at: Date = new Date()): Promise<void> {
		const metadata = input.metadata ?? {};

		await this.database.db.insert(auditEvents).values({
			id: newId(),
			eventType: input.type,
			severity: auditSeverityOf(input.type, metadata),
			outcome: auditOutcomeOf(input.type),
			source: input.source ?? auditSpecOf(input.type).source,
			occurredAt: at,
			actorUserId: input.actor?.id ?? null,
			actorLabel: input.actor?.label ?? null,
			subjectUserId: input.subject?.id ?? null,
			subjectLabel: input.subject?.label ?? null,
			clientId: input.client?.id ?? null,
			clientLabel: input.client?.label ?? null,
			ipAddress: input.meta?.ip ?? null,
			userAgent: input.meta?.userAgent ?? null,
			metadata,
		});
	}

	/** One page of the audit log, newest first, together with the total number of matches. */
	public async list(query: AuditQuery): Promise<AuditPageResponse> {
		const where = conditions(query);
		const order =
			query.order === "oldest"
				? [asc(auditEvents.occurredAt), asc(auditEvents.id)]
				: [desc(auditEvents.occurredAt), desc(auditEvents.id)];
		const [rows, [totals]] = await Promise.all([
			this.selectEvents()
				.where(where)
				.orderBy(...order)
				.offset((query.page - 1) * query.perPage)
				.limit(query.perPage),
			this.database.db.select({ value: count() }).from(auditEvents).where(where),
		]);

		return {
			events: rows.map((row) => toAuditEventDto(row)),
			total: totals?.value ?? 0,
			page: query.page,
			perPage: query.perPage,
		};
	}

	/** The newest events, used by the dashboard. */
	public async recent(limit: number): Promise<AuditEventDto[]> {
		const rows = await this.selectEvents().orderBy(desc(auditEvents.occurredAt), desc(auditEvents.id)).limit(limit);
		return rows.map((row) => toAuditEventDto(row));
	}

	private selectEvents() {
		return this.database.db
			.select(eventWithReferences)
			.from(auditEvents)
			.leftJoin(actors, eq(actors.id, auditEvents.actorUserId))
			.leftJoin(subjects, eq(subjects.id, auditEvents.subjectUserId))
			.leftJoin(oidcClients, eq(oidcClients.id, auditEvents.clientId));
	}

	/** Counts per severity for the current filter, plus the age of the log as a whole. */
	public async summary(query: AuditQuery, retentionDays: number): Promise<AuditSummaryResponse> {
		const where = conditions(query);
		const [counts, [bounds]] = await Promise.all([
			this.database.db
				.select({ severity: auditEvents.severity, value: count() })
				.from(auditEvents)
				.where(where)
				.groupBy(auditEvents.severity),
			this.database.db.select({ oldestAt: min(auditEvents.occurredAt), newestAt: max(auditEvents.occurredAt) }).from(auditEvents),
		]);

		const bySeverity = Object.fromEntries(AUDIT_SEVERITIES.map((severity) => [severity, 0])) as Record<AuditSeverity, number>;
		let total = 0;
		for (const row of counts) {
			bySeverity[row.severity as AuditSeverity] = row.value;
			total += row.value;
		}

		return {
			total,
			bySeverity,
			oldestAt: toIsoOrNull(bounds?.oldestAt ?? null),
			newestAt: toIsoOrNull(bounds?.newestAt ?? null),
			retentionDays,
		};
	}

	/** Sign-ins since `since` with the given outcome; see `signInActivity`. */
	public async countSignIns(outcome: AuditOutcome, since: Date): Promise<number> {
		const [row] = await this.database.db
			.select({ value: count() })
			.from(auditEvents)
			.where(and(signInActivity, withoutDeletedClients, eq(auditEvents.outcome, outcome), gte(auditEvents.occurredAt, since)));
		return row?.value ?? 0;
	}

	/** Sign-ins per UTC day since `since`, split by outcome; see `signInActivity`. */
	public async dailySignIns(since: Date): Promise<{ day: string; outcome: AuditOutcome; value: number }[]> {
		const day = sql<string>`to_char(${auditEvents.occurredAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`;
		const rows = await this.database.db
			.select({ day, outcome: auditEvents.outcome, value: count() })
			.from(auditEvents)
			.where(and(signInActivity, withoutDeletedClients, gte(auditEvents.occurredAt, since)))
			.groupBy(day, auditEvents.outcome);
		return rows.map((row) => ({ day: row.day, outcome: row.outcome as AuditOutcome, value: row.value }));
	}

	/** Existing applications with the most successful authorizations since `since`, under their current name. */
	public async topClients(since: Date, limit: number): Promise<{ id: string; name: string; logoHash: string | null; value: number }[]> {
		const value = count();
		return this.database.db
			.select({ id: oidcClients.id, name: oidcClients.name, logoHash: oidcClients.logoHash, value })
			.from(auditEvents)
			.innerJoin(oidcClients, eq(oidcClients.id, auditEvents.clientId))
			.where(and(eq(auditEvents.eventType, "oidc.authorization.succeeded"), gte(auditEvents.occurredAt, since)))
			.groupBy(oidcClients.id, oidcClients.name, oidcClients.logoHash)
			.orderBy(desc(value), oidcClients.name)
			.limit(limit);
	}

	public async deleteOlderThan(cutoff: Date): Promise<number> {
		const result = await this.database.db.delete(auditEvents).where(lte(auditEvents.occurredAt, cutoff));
		return result.rowCount ?? 0;
	}
}

function toAuditEventDto({ event: row, actor, subject, client }: AuditEventRow): AuditEventDto {
	const type = row.eventType as AuditEventType;
	return {
		id: row.id,
		type,
		category: auditCategoryOf(type),
		severity: row.severity as AuditSeverity,
		outcome: row.outcome as AuditOutcome,
		source: row.source as AuditSource,
		targetType: auditTargetTypeOf(type),
		occurredAt: toIso(row.occurredAt),
		actor: accountReference(row.actorUserId, row.actorLabel, actor),
		subject: accountReference(row.subjectUserId, row.subjectLabel, subject),
		client: clientReference(row.clientId, row.clientLabel, client),
		ipAddress: row.ipAddress,
		userAgent: row.userAgent,
		metadata: row.metadata,
	};
}
