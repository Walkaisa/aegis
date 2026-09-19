import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { bytea, snowflake } from "./columns";
import { users } from "./users";

/**
 * The profile picture of an account: one square WebP re-encoded by the server, never the uploaded
 * file itself. Stored in the database so backups and deployments need no extra volume.
 */
export const userAvatars = pgTable(
	"user_avatars",
	{
		userId: snowflake("user_id")
			.primaryKey()
			.references(() => users.id, { onDelete: "cascade" }),
		/** First 32 hex characters of the SHA-256 of `image`; mirrored in `users.avatar_hash`. */
		hash: text("hash").notNull(),
		image: bytea("image").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [check("user_avatars_hash_check", sql`${table.hash} ~ '^[0-9a-f]{32}$'`)],
);

export type UserAvatarRecord = typeof userAvatars.$inferSelect;
