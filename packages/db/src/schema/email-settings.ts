import { sql } from "drizzle-orm";
import { boolean, check, integer, pgEnum, pgTable, smallint, text, timestamp } from "drizzle-orm/pg-core";

/** `starttls` (upgrade after connecting), `tls` (implicit TLS) or `none`. */
export const smtpSecurity = pgEnum("smtp_security", ["starttls", "tls", "none"]);

/**
 * The SMTP server Aegis sends transactional mail through. Like `system_settings` a singleton, but
 * written only once an admin configures it — a missing row means Aegis sends no mail at all.
 *
 * The password is encrypted with AEGIS_ENCRYPTION_KEY and never leaves the server.
 */
export const emailSettings = pgTable(
	"email_settings",
	{
		id: smallint("id").primaryKey().default(1),
		/** Sending is only attempted while this is true; turning it on verifies the connection first. */
		enabled: boolean("enabled").notNull().default(false),
		host: text("host").notNull(),
		port: integer("port").notNull(),
		security: smtpSecurity("security").notNull(),
		username: text("username"),
		passwordCiphertext: text("password_ciphertext"),
		fromName: text("from_name").notNull(),
		fromAddress: text("from_address").notNull(),
		replyTo: text("reply_to"),
		/** Accepts an unverifiable server certificate; off unless an admin deliberately turns it on. */
		allowInvalidCertificate: boolean("allow_invalid_certificate").notNull().default(false),
		/** When these settings last opened an SMTP session successfully. */
		lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
	},
	(table) => [
		check("email_settings_singleton_check", sql`${table.id} = 1`),
		check("email_settings_host_check", sql`btrim(${table.host}) <> ''`),
		check("email_settings_port_check", sql`${table.port} BETWEEN 1 AND 65535`),
		check("email_settings_from_name_check", sql`btrim(${table.fromName}) <> ''`),
		check("email_settings_from_address_check", sql`${table.fromAddress} LIKE '%_@_%'`),
		check("email_settings_password_check", sql`${table.passwordCiphertext} IS NULL OR ${table.username} IS NOT NULL`),
	],
);

export type EmailSettingsRecord = typeof emailSettings.$inferSelect;
