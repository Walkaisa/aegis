import type { EmailSettingsRequest, EmailTestRequest, EmailTestResponse, Locale } from "@aegis/contracts";
import type { EmailSettingsRecord, UserRecord } from "@aegis/db";
import { type EmailPayload, renderEmail } from "@aegis/email";
import type { FastifyBaseLogger } from "fastify";
import type { AppConfig } from "../config.js";
import type { Encryptor } from "../crypto/encryption.js";
import { ApiError } from "../lib/errors.js";
import type { AuditLog, AuditReference } from "../repositories/audit.js";
import type { EmailSettingsRepository } from "../repositories/email-settings.js";
import type { SettingsRepository } from "../repositories/settings.js";
import type { RequestMeta } from "./auth.js";
import { describeSmtpError, type Mailer, type SmtpConnection } from "./mailer.js";
import { accountReference } from "./users.js";

/** The stored password is bound to the settings row; see `Encryptor`. */
const PASSWORD_CONTEXT = "email_settings:password";

const notConfigured = () => new ApiError(409, "email_not_configured", "No e-mail server is configured, or sending is turned off");
const connectionFailed = (error: unknown) => new ApiError(502, "smtp_connection_failed", describeSmtpError(error));
const deliveryFailed = () => new ApiError(502, "email_delivery_failed", "The message could not be sent");
const passwordRequired = () =>
	new ApiError(400, "validation_failed", "Request validation failed", [{ path: "password", code: "required" }]);

export interface EmailServiceDependencies {
	config: AppConfig;
	settings: SettingsRepository;
	emailSettings: EmailSettingsRepository;
	encryptor: Encryptor;
	audit: AuditLog;
	mailer: Mailer;
	log: FastifyBaseLogger;
}

/** Who and what an outgoing message is recorded against in the audit log. */
export interface DeliveryContext {
	/** The account the message is about; `null` for a message not tied to one. */
	subject?: AuditReference | null;
	/** The account that triggered it, for messages sent from the administration. */
	actor?: AuditReference | null;
	meta?: RequestMeta;
}

type Delivery = { delivered: true } | { delivered: false; error: unknown };

/**
 * The stored password is only ever sent to the server it was entered for: a changed host, port,
 * encryption, user name or certificate check could otherwise hand it to someone else.
 */
function isSameServer(stored: EmailSettingsRecord, input: EmailSettingsRequest): boolean {
	return (
		stored.host === input.host &&
		stored.port === input.port &&
		stored.security === input.security &&
		stored.username === input.username &&
		stored.allowInvalidCertificate === input.allowInvalidCertificate
	);
}

function connectionMetadata(connection: SmtpConnection) {
	return { host: connection.host, port: connection.port, security: connection.security };
}

/**
 * Everything about sending mail: the SMTP settings, the connection test and the delivery of a
 * rendered template. Every attempt — successful or not — becomes an audit event, so the log
 * answers what went out, to whom and why.
 */
export class EmailService {
	private readonly deps: EmailServiceDependencies;

	public constructor(deps: EmailServiceDependencies) {
		this.deps = deps;
	}

	/** Whether Aegis can send right now; every flow that needs mail asks this first. */
	public isEnabled(): boolean {
		return this.deps.emailSettings.getActive() !== null;
	}

	/**
	 * Saves the settings. Turning sending on verifies the connection first: an instance that claims
	 * to send mail but cannot would silently break every password reset.
	 */
	public async save(input: EmailSettingsRequest, actor: AuditReference, meta: RequestMeta): Promise<EmailSettingsRecord> {
		const { emailSettings, encryptor, audit } = this.deps;
		const stored = emailSettings.get();
		const connection = this.toConnection(input);
		const now = new Date();

		if (input.enabled) {
			await this.verify(connection, actor, meta);
		}

		const unchanged = stored !== null && input.password === undefined && isSameServer(stored, input);
		const record = await emailSettings.save(
			{
				enabled: input.enabled,
				host: connection.host,
				port: connection.port,
				security: connection.security,
				username: connection.username,
				passwordCiphertext: connection.password ? encryptor.encrypt(connection.password, PASSWORD_CONTEXT) : null,
				fromName: connection.fromName,
				fromAddress: connection.fromAddress,
				replyTo: connection.replyTo,
				allowInvalidCertificate: connection.allowInvalidCertificate,
				lastVerifiedAt: input.enabled ? now : unchanged ? stored.lastVerifiedAt : null,
			},
			now,
		);

		await audit.record({
			type: "email.settings.updated",
			actor,
			meta,
			metadata: {
				...connectionMetadata(connection),
				fromAddress: record.fromAddress,
				authenticated: record.username !== null,
				allowInvalidCertificate: record.allowInvalidCertificate,
			},
		});
		if ((stored?.enabled ?? false) !== input.enabled) {
			await audit.record({ type: input.enabled ? "email.settings.enabled" : "email.settings.disabled", actor, meta });
		}
		return record;
	}

	/**
	 * Tries the settings in the form without saving them: `verify` opens a session, `send` delivers
	 * a test message to the admin running the test.
	 */
	public async test(input: EmailTestRequest, admin: UserRecord, locale: Locale, meta: RequestMeta): Promise<EmailTestResponse> {
		const connection = this.toConnection(input);
		const actor = accountReference(admin);
		const startedAt = Date.now();

		if (input.mode === "verify") {
			await this.verify(connection, actor, meta);
			const durationMs = Date.now() - startedAt;
			await this.deps.audit.record({
				type: "email.connection.tested",
				actor,
				meta,
				metadata: { ...connectionMetadata(connection), durationMs },
			});
			return { mode: input.mode, durationMs, deliveredTo: null };
		}

		const delivery = await this.dispatch(
			connection,
			{
				template: "email_test",
				data: {
					displayName: admin.displayName,
					recipient: admin.email,
					sentAt: new Date(),
					server: `${connection.host}:${connection.port}`,
					security: connection.security,
					sender: `${connection.fromName} <${connection.fromAddress}>`,
				},
			},
			locale,
			{ actor, meta },
		);
		if (!delivery.delivered) {
			throw connectionFailed(delivery.error);
		}
		return { mode: input.mode, durationMs: Date.now() - startedAt, deliveredTo: admin.email };
	}

	/**
	 * Sends a message and reports failure to the caller. Used where the outcome changes what the
	 * user sees, such as a confirmation link that never left the building.
	 */
	public async send(payload: EmailPayload, locale: Locale, context: DeliveryContext = {}): Promise<void> {
		const connection = this.activeConnection();
		if (!connection) {
			throw notConfigured();
		}
		const delivery = await this.dispatch(connection, payload, locale, context);
		if (!delivery.delivered) {
			throw deliveryFailed();
		}
	}

	/**
	 * Sends a message without letting a delivery problem change the outcome of the surrounding
	 * flow: a security notification that bounces must not undo the password change it was about.
	 * The audit log keeps the failure either way.
	 */
	public async deliver(payload: EmailPayload, locale: Locale, context: DeliveryContext = {}): Promise<boolean> {
		try {
			await this.send(payload, locale, context);
			return true;
		} catch (error) {
			if (!(error instanceof ApiError)) {
				this.deps.log.error({ err: error, template: payload.template }, "Rendering an e-mail failed");
			}
			return false;
		}
	}

	/**
	 * Turns submitted settings into a connection. An omitted password falls back to the stored one
	 * as long as it goes to the same server, so neither saving nor testing forces the admin to
	 * retype it; a user name always needs a password.
	 */
	private toConnection(input: EmailSettingsRequest): SmtpConnection {
		const stored = this.deps.emailSettings.get();
		const kept =
			input.password === undefined && stored?.passwordCiphertext && isSameServer(stored, input) ? stored.passwordCiphertext : null;
		const password = kept ? this.deps.encryptor.decryptString(kept, PASSWORD_CONTEXT) : input.password || null;
		if (input.username && !password) {
			throw passwordRequired();
		}

		return {
			host: input.host,
			port: input.port,
			security: input.security,
			username: input.username,
			// Without a user name there is nothing to authenticate with, so the password is dropped.
			password: input.username ? password : null,
			fromName: input.fromName,
			fromAddress: input.fromAddress,
			replyTo: input.replyTo,
			allowInvalidCertificate: input.allowInvalidCertificate,
		};
	}

	/** The settings to send with, decrypted; `null` while sending is off. */
	private activeConnection(): SmtpConnection | null {
		const record = this.deps.emailSettings.getActive();
		if (!record) {
			return null;
		}

		return {
			host: record.host,
			port: record.port,
			security: record.security,
			username: record.username,
			password: record.passwordCiphertext ? this.deps.encryptor.decryptString(record.passwordCiphertext, PASSWORD_CONTEXT) : null,
			fromName: record.fromName,
			fromAddress: record.fromAddress,
			replyTo: record.replyTo,
			allowInvalidCertificate: record.allowInvalidCertificate,
		};
	}

	/** Opens a session with the server; a refusal is recorded and reported with the server's reply. */
	private async verify(connection: SmtpConnection, actor: AuditReference, meta: RequestMeta): Promise<void> {
		try {
			await this.deps.mailer.verify(connection);
		} catch (error) {
			await this.deps.audit.record({
				type: "email.connection.failed",
				actor,
				meta,
				metadata: { ...connectionMetadata(connection), error: describeSmtpError(error) },
			});
			throw connectionFailed(error);
		}
	}

	/** Renders, sends and records exactly one message. */
	private async dispatch(connection: SmtpConnection, payload: EmailPayload, locale: Locale, context: DeliveryContext): Promise<Delivery> {
		const { audit, mailer, settings, config } = this.deps;
		const startedAt = Date.now();
		const brand = { instanceName: settings.get()?.instanceName ?? "Aegis", issuer: config.issuer };
		const rendered = await renderEmail(payload, { brand, locale });
		const event = { actor: context.actor ?? null, subject: context.subject ?? null, meta: context.meta };
		const details = { template: payload.template, recipient: rendered.recipient, subject: rendered.subject, locale };

		let messageId: string | null;
		try {
			({ messageId } = await mailer.send(connection, {
				to: rendered.recipient,
				subject: rendered.subject,
				html: rendered.html,
				text: rendered.text,
			}));
		} catch (error) {
			await audit.record({ type: "email.failed", ...event, metadata: { ...details, error: describeSmtpError(error) } });
			return { delivered: false, error };
		}

		await audit.record({ type: "email.sent", ...event, metadata: { ...details, messageId, durationMs: Date.now() - startedAt } });
		return { delivered: true };
	}
}
