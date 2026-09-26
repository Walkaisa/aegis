import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";
import { users } from "./users";

/** What a link sent by e-mail may be redeemed for. */
export const accountTokenPurpose = pgEnum("account_token_purpose", ["password_reset", "email_change"]);

/**
 * Single-use links sent by e-mail: password resets and e-mail address confirmations.
 *
 * Only a SHA-256 hash of the token is stored, so a copy of the database does not hand out working
 * links. A spent token keeps its row with `consumed_at` set until the maintenance run removes it,
 * which lets a reused link be told apart from one that never existed.
 */
export const accountTokens = pgTable(
	"account_tokens",
	{
		id: snowflake("id").primaryKey(),
		userId: snowflake("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		purpose: accountTokenPurpose("purpose").notNull(),
		tokenHash: text("token_hash").notNull().unique("account_tokens_token_hash_key"),
		/** The requested address, for `email_change`; NULL otherwise. */
		targetEmail: text("target_email"),
		/** `target_email` in its canonical form, used for the uniqueness check at confirmation time. */
		targetEmailNormalized: text("target_email_normalized"),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("account_tokens_user_id_purpose_idx").on(table.userId, table.purpose),
		index("account_tokens_expires_at_idx").on(table.expiresAt),
		/** At most one open e-mail change per address, so two accounts cannot claim it at once. */
		uniqueIndex("account_tokens_pending_target_email_key")
			.on(table.targetEmailNormalized)
			.where(sql`${table.consumedAt} IS NULL AND ${table.targetEmailNormalized} IS NOT NULL`),
		check("account_tokens_target_email_check", sql`(${table.purpose} = 'email_change') = (${table.targetEmail} IS NOT NULL)`),
		check(
			"account_tokens_target_email_normalized_check",
			sql`(${table.targetEmail} IS NULL) = (${table.targetEmailNormalized} IS NULL)`,
		),
		check("account_tokens_expires_at_check", sql`${table.expiresAt} > ${table.createdAt}`),
	],
);

export type AccountTokenRecord = typeof accountTokens.$inferSelect;
export type AccountTokenPurpose = (typeof accountTokenPurpose.enumValues)[number];
