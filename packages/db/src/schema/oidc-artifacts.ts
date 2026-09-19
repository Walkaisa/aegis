import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Persistence for oidc-provider models: provider sessions, interactions, grants, authorization
 * codes and tokens. Lookup columns are extracted from the payload so artifacts can be revoked per
 * grant, client or account.
 */
export const oidcArtifacts = pgTable(
	"oidc_artifacts",
	{
		model: text("model").notNull(),
		id: text("id").notNull(),
		payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
		grantId: text("grant_id"),
		userCode: text("user_code"),
		uid: text("uid"),
		/** The public OAuth `client_id`. */
		clientId: text("client_id"),
		/** The OIDC subject, i.e. `users.id`. */
		accountId: text("account_id"),
		expiresAt: timestamp("expires_at", { withTimezone: true }),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
	},
	(table) => [
		primaryKey({ name: "oidc_artifacts_pkey", columns: [table.model, table.id] }),
		index("oidc_artifacts_grant_id_idx").on(table.grantId).where(sql`grant_id IS NOT NULL`),
		index("oidc_artifacts_uid_idx").on(table.model, table.uid).where(sql`uid IS NOT NULL`),
		index("oidc_artifacts_user_code_idx").on(table.model, table.userCode).where(sql`user_code IS NOT NULL`),
		index("oidc_artifacts_client_id_idx").on(table.clientId).where(sql`client_id IS NOT NULL`),
		index("oidc_artifacts_account_id_idx").on(table.accountId).where(sql`account_id IS NOT NULL`),
		index("oidc_artifacts_expires_at_idx").on(table.expiresAt).where(sql`expires_at IS NOT NULL`),
	],
);
