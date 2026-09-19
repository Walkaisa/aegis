import { sql } from "drizzle-orm";
import { boolean, check, index, integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { snowflake } from "./columns";

/**
 * The role of an account. Users sign in to applications through OpenID Connect; admins may do the
 * same and also manage Aegis. What a role may do is defined by `ROLE_PERMISSIONS` in `@aegis/contracts`.
 */
export const accountRole = pgEnum("account_role", ["admin", "user"]);

export const users = pgTable(
	"users",
	{
		id: snowflake("id").primaryKey(),
		/** As entered, for display. */
		email: text("email").notNull(),
		/** `email.trim().toLowerCase()`; used for sign-in lookups and uniqueness. */
		emailNormalized: text("email_normalized").notNull().unique("users_email_normalized_key"),
		displayName: text("display_name").notNull(),
		passwordHash: text("password_hash").notNull(),
		role: accountRole("role").notNull(),
		enabled: boolean("enabled").notNull().default(true),
		emailVerified: boolean("email_verified").notNull().default(false),
		passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }).notNull(),
		lastSignInAt: timestamp("last_sign_in_at", { withTimezone: true }),
		/**
		 * Content hash of the current profile picture (like Discord's avatar hash), or NULL without
		 * one. It is part of the image URL, so a new picture gets a new, immutably cacheable URL.
		 */
		avatarHash: text("avatar_hash"),
		/**
		 * The TOTP secret for two-factor authentication, encrypted at rest. Set as soon as the setup
		 * starts; two-factor authentication is only active once `totp_enabled_at` is set as well.
		 */
		totpSecret: text("totp_secret"),
		totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
		/** Name of the authenticator chosen by the account owner, e.g. "Bitwarden"; NULL shows a default. */
		totpLabel: text("totp_label"),
		/** Time step of the last accepted code; every code can be used only once. */
		totpLastCounter: integer("totp_last_counter"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		index("users_role_enabled_idx").on(table.role, table.enabled),
		check(
			"users_email_normalized_check",
			sql`${table.emailNormalized} = lower(${table.emailNormalized}) AND ${table.emailNormalized} = btrim(${table.emailNormalized}) AND ${table.emailNormalized} <> ''`,
		),
		check("users_display_name_check", sql`btrim(${table.displayName}) <> ''`),
		check("users_avatar_hash_check", sql`${table.avatarHash} ~ '^[0-9a-f]{32}$'`),
		check("users_totp_enabled_check", sql`${table.totpEnabledAt} IS NULL OR ${table.totpSecret} IS NOT NULL`),
		check("users_totp_label_check", sql`btrim(${table.totpLabel}) <> '' AND char_length(${table.totpLabel}) <= 64`),
	],
);

export type UserRecord = typeof users.$inferSelect;
export type NewUserRecord = typeof users.$inferInsert;
export type AccountRole = (typeof accountRole.enumValues)[number];
