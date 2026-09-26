import { z } from "zod";
import type { IsoDateString } from "./common";
import { displayNameSchema, emailSchema } from "./identity";

/**
 * How the connection to the SMTP server is encrypted.
 *
 * - `starttls`: connect in the clear and upgrade before authenticating (submission, port 587)
 * - `tls`: TLS from the first byte (implicit TLS, port 465)
 * - `none`: no encryption — only sensible for a relay on localhost or inside a container network
 */
export const SMTP_SECURITY_MODES = ["starttls", "tls", "none"] as const;

export type SmtpSecurity = (typeof SMTP_SECURITY_MODES)[number];

/** The port each security mode is registered for; offered as the default when the mode changes. */
export const SMTP_DEFAULT_PORTS: Record<SmtpSecurity, number> = { starttls: 587, tls: 465, none: 25 };

export const SMTP_HOST_MAX_LENGTH = 253;
export const SMTP_USERNAME_MAX_LENGTH = 320;
export const SMTP_PASSWORD_MAX_LENGTH = 512;

/** A hostname or IP address, without scheme, port or path. */
const smtpHostSchema = z
	.string({ error: "required" })
	.trim()
	.min(1, { error: "required" })
	.max(SMTP_HOST_MAX_LENGTH, { error: "too_long" })
	.refine((value) => !/[\s/@]/.test(value) && !value.includes(":"), { error: "smtp_host_invalid" });

/** An optional text field: an empty input means "not set" rather than an empty string. */
function optionalText(schema: z.ZodType<string>) {
	return z.preprocess((value) => (typeof value === "string" && value.trim() === "" ? null : value), schema.nullable().default(null));
}

export const emailSettingsSchema = z.object({
	/** Whether Aegis sends e-mail. Turning it on verifies the connection first. */
	enabled: z.boolean({ error: "required" }),
	host: smtpHostSchema,
	port: z.number({ error: "invalid" }).int({ error: "invalid" }).min(1, { error: "out_of_range" }).max(65535, { error: "out_of_range" }),
	security: z.enum(SMTP_SECURITY_MODES, { error: "invalid" }),
	username: optionalText(z.string().trim().max(SMTP_USERNAME_MAX_LENGTH, { error: "too_long" })),
	/**
	 * The SMTP password; it is never read back out of the API and only kept together with a user
	 * name. Omitted, the stored one is used, but only for the server it was entered for: a changed
	 * host, port, encryption, user name or certificate check requires it again.
	 */
	password: z.string().max(SMTP_PASSWORD_MAX_LENGTH, { error: "too_long" }).optional(),
	/** Display name of the sender, e.g. "Aegis". */
	fromName: displayNameSchema,
	/** Envelope and header sender. Many providers require it to match the authenticated account. */
	fromAddress: emailSchema,
	replyTo: optionalText(emailSchema),
	/**
	 * Accepts a self-signed or otherwise unverifiable server certificate. Off by default; only for
	 * an internal relay whose certificate cannot be validated.
	 */
	allowInvalidCertificate: z.boolean({ error: "required" }).default(false),
});

export type EmailSettingsRequest = z.infer<typeof emailSettingsSchema>;

/** What a connection test does: open a session, or additionally deliver a test message. */
export const EMAIL_TEST_MODES = ["verify", "send"] as const;

export type EmailTestMode = (typeof EMAIL_TEST_MODES)[number];

/**
 * Tests the settings currently in the form, which may differ from the stored ones. The password
 * follows the rules of `emailSettingsSchema`; a test message goes to the admin running the test.
 */
export const emailTestSchema = emailSettingsSchema.extend({
	mode: z.enum(EMAIL_TEST_MODES, { error: "invalid" }).default("verify"),
});

export type EmailTestRequest = z.infer<typeof emailTestSchema>;

export interface EmailSettingsDto {
	enabled: boolean;
	/** `false` while no SMTP server has been stored yet; the form then starts empty. */
	configured: boolean;
	host: string;
	port: number;
	security: SmtpSecurity;
	username: string | null;
	/** Whether a password is stored. The password itself never leaves the server. */
	hasPassword: boolean;
	fromName: string;
	fromAddress: string;
	replyTo: string | null;
	allowInvalidCertificate: boolean;
	/** When the stored settings last opened a session successfully. */
	lastVerifiedAt: IsoDateString | null;
	updatedAt: IsoDateString | null;
}

export interface EmailTestResponse {
	mode: EmailTestMode;
	/** How long the SMTP session took, in milliseconds. */
	durationMs: number;
	/** The address a test message went to; `null` for a connection test. */
	deliveredTo: string | null;
}
