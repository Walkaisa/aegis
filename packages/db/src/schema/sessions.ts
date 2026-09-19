import { sql } from "drizzle-orm";
import { check, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";
import { oidcClients } from "./oidc-clients";
import { users } from "./users";

/**
 * Aegis browser sessions. One session serves the administration and application sign-ins alike;
 * what it may be used for is decided by the role of the owning account.
 */
export const sessions = pgTable(
	"sessions",
	{
		id: snowflake("id").primaryKey(),
		userId: snowflake("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		/** SHA-256 of the session cookie value; the token itself is never stored. */
		tokenHash: text("token_hash").notNull().unique("sessions_token_hash_key"),
		authenticatedAt: timestamp("authenticated_at", { withTimezone: true }).notNull(),
		/**
		 * How the account authenticated (RFC 8176), e.g. `{pwd}` or `{pwd,otp,mfa}`. Passed on to
		 * applications as the `amr` and `acr` claims when they rely on this session.
		 */
		amr: text("amr").array().notNull().default(sql`'{pwd}'::text[]`),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		ipAddress: text("ip_address"),
		userAgent: text("user_agent"),
	},
	(table) => [
		index("sessions_user_id_idx").on(table.userId),
		index("sessions_expires_at_idx").on(table.expiresAt),
		check("sessions_expires_at_check", sql`${table.expiresAt} > ${table.createdAt}`),
	],
);

/** Which session signed in to which application. */
export const sessionApplications = pgTable(
	"session_applications",
	{
		sessionId: snowflake("session_id")
			.notNull()
			.references(() => sessions.id, { onDelete: "cascade" }),
		clientId: snowflake("client_id")
			.notNull()
			.references(() => oidcClients.id, { onDelete: "cascade" }),
		firstAuthorizedAt: timestamp("first_authorized_at", { withTimezone: true }).notNull(),
		lastAuthorizedAt: timestamp("last_authorized_at", { withTimezone: true }).notNull(),
	},
	(table) => [
		primaryKey({ name: "session_applications_pkey", columns: [table.sessionId, table.clientId] }),
		index("session_applications_client_id_idx").on(table.clientId, table.lastAuthorizedAt),
	],
);

export type SessionRecord = typeof sessions.$inferSelect;
export type NewSessionRecord = typeof sessions.$inferInsert;
