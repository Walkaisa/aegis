import { sql } from "drizzle-orm";
import { check, integer, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Instance-wide settings. The single row is written by the initial setup; its existence marks the
 * setup as completed for good.
 */
export const systemSettings = pgTable(
	"system_settings",
	{
		id: smallint("id").primaryKey().default(1),
		instanceName: text("instance_name").notNull(),
		sessionTtlSeconds: integer("session_ttl_seconds").notNull(),
		/** How long audit events are kept before the maintenance run removes them. */
		auditRetentionDays: integer("audit_retention_days").notNull().default(180),
		/** Ciphertext of a known value; detects a changed AEGIS_ENCRYPTION_KEY on startup. */
		encryptionKeyCheck: text("encryption_key_check").notNull(),
		setupCompletedAt: timestamp("setup_completed_at", { withTimezone: true }).notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		check("system_settings_singleton_check", sql`${table.id} = 1`),
		check("system_settings_instance_name_check", sql`btrim(${table.instanceName}) <> ''`),
		check("system_settings_session_ttl_check", sql`${table.sessionTtlSeconds} BETWEEN 86400 AND 7776000`),
		check("system_settings_audit_retention_check", sql`${table.auditRetentionDays} BETWEEN 1 AND 3650`),
	],
);

export type SystemSettingsRecord = typeof systemSettings.$inferSelect;
