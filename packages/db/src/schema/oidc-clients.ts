import { sql } from "drizzle-orm";
import { boolean, check, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";

export const clientType = pgEnum("client_type", ["confidential", "public"]);

export const tokenEndpointAuthMethod = pgEnum("token_endpoint_auth_method", ["client_secret_basic", "client_secret_post", "none"]);

/** Who may sign in besides admins: every account, or only the accounts in `client_assignments`. */
export const clientAccessPolicy = pgEnum("client_access_policy", ["everyone", "assigned"]);

/** Whether authorization requests must use PKCE (S256); public clients are always `required`. */
export const pkcePolicy = pgEnum("pkce_policy", ["required", "optional", "disabled"]);

/** Applications that sign in users through Aegis. */
export const oidcClients = pgTable(
	"oidc_clients",
	{
		/** Like on Discord, the application's snowflake is also its public OAuth `client_id`. */
		id: snowflake("id").primaryKey(),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		clientType: clientType("client_type").notNull(),
		tokenEndpointAuthMethod: tokenEndpointAuthMethod("token_endpoint_auth_method").notNull(),
		clientSecretCiphertext: text("client_secret_ciphertext"),
		clientSecretRotatedAt: timestamp("client_secret_rotated_at", { withTimezone: true }),
		redirectUris: text("redirect_uris").array().notNull(),
		postLogoutRedirectUris: text("post_logout_redirect_uris").array().notNull().default(sql`'{}'::text[]`),
		allowedScopes: text("allowed_scopes").array().notNull(),
		skipConsent: boolean("skip_consent").notNull().default(false),
		enabled: boolean("enabled").notNull().default(true),
		accessPolicy: clientAccessPolicy("access_policy").notNull().default("everyone"),
		pkcePolicy: pkcePolicy("pkce_policy").notNull(),
		lastAuthorizedAt: timestamp("last_authorized_at", { withTimezone: true }),
		/** Content hash of the current logo, or NULL without one; part of the logo URL like `users.avatar_hash`. */
		logoHash: text("logo_hash"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		check("oidc_clients_name_check", sql`btrim(${table.name}) <> ''`),
		check("oidc_clients_logo_hash_check", sql`${table.logoHash} ~ '^[0-9a-f]{32}$'`),
		check("oidc_clients_secret_check", sql`(${table.clientType} = 'public') = (${table.clientSecretCiphertext} IS NULL)`),
		check("oidc_clients_auth_method_check", sql`(${table.clientType} = 'public') = (${table.tokenEndpointAuthMethod} = 'none')`),
		check("oidc_clients_pkce_policy_check", sql`${table.clientType} = 'confidential' OR ${table.pkcePolicy} = 'required'`),
		check("oidc_clients_redirect_uris_check", sql`cardinality(${table.redirectUris}) >= 1`),
		check(
			"oidc_clients_allowed_scopes_check",
			sql`'openid' = ANY(${table.allowedScopes}) AND ${table.allowedScopes} <@ ARRAY['openid', 'profile', 'email']::text[]`,
		),
	],
);

export type OidcClientRecord = typeof oidcClients.$inferSelect;
export type NewOidcClientRecord = typeof oidcClients.$inferInsert;
