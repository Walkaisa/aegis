import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";
import { oidcClients } from "./oidc-clients";
import { users } from "./users";

export type AuditMetadataValue = string | number | boolean | null | string[];

/**
 * Append-only audit trail. Labels capture names at the time of the event, so history stays
 * readable after accounts or applications are deleted (their ids are then set to NULL).
 * Metadata must never contain secrets.
 */
export const auditEvents = pgTable(
	"audit_events",
	{
		id: snowflake("id").primaryKey(),
		eventType: text("event_type").notNull(),
		/** Classification of the event, denormalized so the audit log can filter on it in SQL. */
		severity: text("severity").notNull().default("info"),
		outcome: text("outcome").notNull().default("success"),
		source: text("source").notNull().default("system"),
		occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
		actorUserId: snowflake("actor_user_id").references(() => users.id, { onDelete: "set null" }),
		actorLabel: text("actor_label"),
		subjectUserId: snowflake("subject_user_id").references(() => users.id, { onDelete: "set null" }),
		subjectLabel: text("subject_label"),
		clientId: snowflake("client_id").references(() => oidcClients.id, { onDelete: "set null" }),
		clientLabel: text("client_label"),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
		metadata: jsonb("metadata").$type<Record<string, AuditMetadataValue>>().notNull().default(sql`'{}'::jsonb`),
	},
	(table) => [
		index("audit_events_occurred_at_idx").on(table.occurredAt),
		index("audit_events_event_type_occurred_at_idx").on(table.eventType, table.occurredAt),
		index("audit_events_severity_occurred_at_idx").on(table.severity, table.occurredAt),
		index("audit_events_outcome_occurred_at_idx").on(table.outcome, table.occurredAt),
		index("audit_events_source_occurred_at_idx").on(table.source, table.occurredAt),
		index("audit_events_actor_user_id_idx").on(table.actorUserId),
		index("audit_events_subject_user_id_idx").on(table.subjectUserId),
		check("audit_events_severity_check", sql`${table.severity} IN ('info', 'notice', 'warning', 'error', 'critical')`),
		check("audit_events_outcome_check", sql`${table.outcome} IN ('success', 'failure')`),
		check("audit_events_source_check", sql`${table.source} IN ('admin', 'user', 'application', 'system')`),
		check("audit_events_event_type_check", sql`${table.eventType} ~ '^[a-z_]+(\\.[a-z_]+)+$'`),
	],
);

export type AuditEventRecord = typeof auditEvents.$inferSelect;
