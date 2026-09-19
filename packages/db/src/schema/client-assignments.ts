import { index, pgTable, primaryKey, timestamp } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";
import { oidcClients } from "./oidc-clients";
import { users } from "./users";

/** Accounts assigned to an application; they decide who may sign in while its access policy is `assigned`. */
export const clientAssignments = pgTable(
	"client_assignments",
	{
		clientId: snowflake("client_id")
			.notNull()
			.references(() => oidcClients.id, { onDelete: "cascade" }),
		userId: snowflake("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		primaryKey({ name: "client_assignments_pkey", columns: [table.clientId, table.userId] }),
		index("client_assignments_user_id_idx").on(table.userId),
	],
);

export type ClientAssignmentRecord = typeof clientAssignments.$inferSelect;
