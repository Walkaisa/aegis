import { pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";
import { oidcClients } from "./oidc-clients";
import { users } from "./users";

/**
 * Scopes a user approved for an application. oidc-provider grants are bound to a single provider
 * session; this table lets consent survive signing out and in again.
 */
export const oidcConsents = pgTable(
	"oidc_consents",
	{
		userId: snowflake("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		clientId: snowflake("client_id")
			.notNull()
			.references(() => oidcClients.id, { onDelete: "cascade" }),
		scopes: text("scopes").array().notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [primaryKey({ name: "oidc_consents_pkey", columns: [table.userId, table.clientId] })],
);
