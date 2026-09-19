import { sql } from "drizzle-orm";
import { check, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { bytea, snowflake } from "./columns";
import { oidcClients } from "./oidc-clients";

/**
 * The logo of an application: one square WebP re-encoded by the server, never the uploaded file
 * itself. Stored like profile pictures (see `user_avatars`).
 */
export const clientLogos = pgTable(
	"client_logos",
	{
		clientId: snowflake("client_id")
			.primaryKey()
			.references(() => oidcClients.id, { onDelete: "cascade" }),
		/** First 32 hex characters of the SHA-256 of `image`; mirrored in `oidc_clients.logo_hash`. */
		hash: text("hash").notNull(),
		image: bytea("image").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [check("client_logos_hash_check", sql`${table.hash} ~ '^[0-9a-f]{32}$'`)],
);

export type ClientLogoRecord = typeof clientLogos.$inferSelect;
