import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";

export const signingKeyStatus = pgEnum("signing_key_status", ["active", "retired"]);

/** ID token signing keys. Private JWKs are encrypted with AEGIS_ENCRYPTION_KEY. */
export const signingKeys = pgTable(
	"signing_keys",
	{
		kid: text("kid").primaryKey(),
		algorithm: text("algorithm").notNull(),
		privateJwkCiphertext: text("private_jwk_ciphertext").notNull(),
		status: signingKeyStatus("status").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		retiredAt: timestamp("retired_at", { withTimezone: true }),
	},
	(table) => [
		uniqueIndex("signing_keys_single_active_idx").on(table.status).where(sql`status = 'active'`),
		check("signing_keys_retired_at_check", sql`(${table.status} = 'retired') = (${table.retiredAt} IS NOT NULL)`),
	],
);

/** Keys oidc-provider signs its cookies with. Encrypted with AEGIS_ENCRYPTION_KEY. */
export const cookieKeys = pgTable("cookie_keys", {
	id: snowflake("id").primaryKey(),
	keyCiphertext: text("key_ciphertext").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SigningKeyRecord = typeof signingKeys.$inferSelect;
export type CookieKeyRecord = typeof cookieKeys.$inferSelect;
