import { pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";
import { users } from "./users";

/**
 * One-time recovery codes for two-factor authentication. Only a SHA-256 hash of each code is
 * stored; a used code keeps its row with `used_at` set, so the remaining count stays visible.
 */
export const recoveryCodes = pgTable(
	"recovery_codes",
	{
		id: snowflake("id").primaryKey(),
		userId: snowflake("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		codeHash: text("code_hash").notNull(),
		usedAt: timestamp("used_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	// The unique constraint's index also serves lookups by account.
	(table) => [unique("recovery_codes_user_id_code_hash_key").on(table.userId, table.codeHash)],
);

export type RecoveryCodeRecord = typeof recoveryCodes.$inferSelect;
