import type { SmtpSecurity } from "@aegis/contracts";
import { createTransport, type SMTPTransportOptions } from "nodemailer";
import { SECOND_MS } from "../lib/time.js";

/** Everything needed to open a session with the configured server. */
export interface SmtpConnection {
	host: string;
	port: number;
	security: SmtpSecurity;
	username: string | null;
	password: string | null;
	fromName: string;
	fromAddress: string;
	replyTo: string | null;
	allowInvalidCertificate: boolean;
}

export interface OutgoingMessage {
	to: string;
	subject: string;
	html: string;
	text: string;
}

const CONNECTION_TIMEOUT_MS = 10 * SECOND_MS;
const GREETING_TIMEOUT_MS = 10 * SECOND_MS;
const SOCKET_TIMEOUT_MS = 20 * SECOND_MS;
const MAX_DETAIL_LENGTH = 300;

/**
 * Turns whatever nodemailer threw into one readable line for the admin who configured the server.
 * The SMTP reply is the useful part ("535 authentication failed"), so it is kept, shortened and
 * stripped of line breaks.
 */
export function describeSmtpError(error: unknown): string {
	if (!(error instanceof Error)) {
		return "The e-mail server could not be reached";
	}

	const { code, response } = error as Error & { code?: string; response?: string };
	const detail = (response ?? error.message).replace(/\s+/g, " ").trim();
	const prefix = code ? `${code}: ` : "";
	return `${prefix}${detail}`.slice(0, MAX_DETAIL_LENGTH);
}

function transportOptions(connection: SmtpConnection): SMTPTransportOptions {
	return {
		host: connection.host,
		port: connection.port,
		// Implicit TLS talks TLS from the first byte; STARTTLS connects in the clear and upgrades.
		secure: connection.security === "tls",
		requireTLS: connection.security === "starttls",
		ignoreTLS: connection.security === "none",
		auth: connection.username ? { user: connection.username, pass: connection.password ?? "" } : undefined,
		tls: {
			rejectUnauthorized: !connection.allowInvalidCertificate,
			minVersion: "TLSv1.2",
		},
		connectionTimeout: CONNECTION_TIMEOUT_MS,
		greetingTimeout: GREETING_TIMEOUT_MS,
		socketTimeout: SOCKET_TIMEOUT_MS,
		// One message at a time: an instance of this size never needs a connection pool.
		pool: false,
		disableFileAccess: true,
		disableUrlAccess: true,
	};
}

/**
 * The SMTP client. It knows how to open a session and hand a message over; what to send and
 * whether sending is allowed at all is decided by `EmailService`.
 */
export class Mailer {
	/** Opens a session and authenticates, without sending anything. */
	public async verify(connection: SmtpConnection): Promise<void> {
		await createTransport(transportOptions(connection)).verify();
	}

	public async send(connection: SmtpConnection, message: OutgoingMessage): Promise<{ messageId: string | null }> {
		const info = await createTransport(transportOptions(connection)).sendMail({
			from: { name: connection.fromName, address: connection.fromAddress },
			...(connection.replyTo ? { replyTo: connection.replyTo } : {}),
			to: message.to,
			subject: message.subject,
			html: message.html,
			text: message.text,
			headers: {
				// Keeps out-of-office replies and other robots from answering a transactional message.
				"Auto-Submitted": "auto-generated",
				"X-Auto-Response-Suppress": "All",
			},
		});
		return { messageId: info.messageId ?? null };
	}
}
