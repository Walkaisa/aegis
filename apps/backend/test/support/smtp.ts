import type { AddressInfo } from "node:net";
import { type ParsedMail, simpleParser } from "mailparser";
import { SMTPServer, type SMTPServerOptions } from "smtp-server";
import { expect, vi } from "vitest";
import { test as aegisTest } from "./aegis.js";
import type { TestClient } from "./client.js";

export interface ReceivedMail {
	from: string;
	to: string[];
	subject: string;
	text: string;
	html: string;
	headers: ParsedMail["headers"];
	replyTo: string | null;
}

export interface TestSmtpServer {
	port: number;
	received: ReceivedMail[];
	/** Rejects the next recipient with a permanent error, like a mailbox that does not exist. */
	rejectNextRecipient(): void;
	/** The link a message points to, e.g. `#token=…` of a password reset. Fails without a message. */
	tokenOf(mail: ReceivedMail | undefined): string;
	close(): Promise<void>;
}

export interface TestSmtpOptions {
	/** Implicit TLS from the first byte; otherwise plain text with STARTTLS offered. */
	secure?: boolean;
	/** Credentials the server accepts; without them it accepts anonymous submission. */
	credentials?: { username: string; password: string };
}

/**
 * An SMTP server in the test process, with the self-signed localhost certificate of `smtp-server`.
 * Messages are parsed like a mail client would, so assertions read the decoded text.
 */
export async function startSmtpServer({ secure = false, credentials }: TestSmtpOptions = {}): Promise<TestSmtpServer> {
	const received: ReceivedMail[] = [];
	let rejectRecipient = false;

	const options: SMTPServerOptions = {
		secure,
		authOptional: !credentials,
		// The plain-text test server accepts credentials too; production settings decide what Aegis sends.
		allowInsecureAuth: true,
		disabledCommands: credentials ? [] : ["AUTH"],
		logger: false,
		// smtp-server keeps a connection the client half-closed after a failed login; closing the
		// server would otherwise wait 30 s for it.
		closeTimeout: 100,
		onAuth(auth, _session, callback) {
			if (auth.username === credentials?.username && auth.password === credentials?.password) {
				callback(null, { user: auth.username });
			} else {
				callback(Object.assign(new Error("Invalid username or password"), { responseCode: 535 }));
			}
		},
		onRcptTo(address, _session, callback) {
			if (rejectRecipient) {
				rejectRecipient = false;
				callback(Object.assign(new Error(`Mailbox ${address.address} unavailable`), { responseCode: 550 }));
				return;
			}
			callback();
		},
		onData(stream, session, callback) {
			simpleParser(stream).then(
				(mail) => {
					received.push({
						from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
						to: session.envelope.rcptTo.map((recipient) => recipient.address),
						subject: mail.subject ?? "",
						text: mail.text ?? "",
						html: typeof mail.html === "string" ? mail.html : "",
						headers: mail.headers,
						replyTo: mail.replyTo?.text ?? null,
					});
					callback();
				},
				(error: Error) => callback(error),
			);
		},
	};

	const server = new SMTPServer(options);
	// A client may drop the connection at any point, e.g. after a rejected recipient; a real server
	// shrugs that off. Anything else fails the test when the server closes.
	const errors: Error[] = [];
	server.on("error", (error: NodeJS.ErrnoException) => {
		if (error.code !== "ECONNRESET") {
			errors.push(error);
		}
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const { port } = server.server.address() as AddressInfo;

	return {
		port,
		received,
		rejectNextRecipient() {
			rejectRecipient = true;
		},
		tokenOf(mail) {
			if (!mail) {
				throw new Error("No message");
			}
			const token = /#token=([\w-]+)/.exec(mail.text)?.[1];
			if (!token) {
				throw new Error(`No link in "${mail.subject}"`);
			}
			return token;
		},
		async close() {
			await new Promise<void>((resolve) => server.close(() => resolve()));
			if (errors.length > 0) {
				throw new AggregateError(errors, "The test SMTP server failed");
			}
		},
	};
}

/** Settings as the e-mail form submits them, pointing at a test server. */
export function smtpSettings(port: number, overrides: Record<string, unknown> = {}) {
	return {
		enabled: true,
		host: "127.0.0.1",
		port,
		security: "none",
		username: "",
		fromName: "Aegis Test",
		fromAddress: "aegis@aegis.test",
		replyTo: "",
		allowInvalidCertificate: false,
		...overrides,
	};
}

/** `test` with a fresh Aegis and an SMTP server: `test("…", async ({ aegis, smtp }) => { … })`. */
export const test = aegisTest.extend<{ smtp: TestSmtpServer }>({
	// biome-ignore lint/correctness/noEmptyPattern: Vitest reads the fixtures a fixture depends on from this pattern.
	smtp: async ({}, use) => {
		const server = await startSmtpServer();
		await use(server);
		await server.close();
	},
});

/** Turns sending on through the administration, pointing at `smtp`. */
export async function enableEmail(admin: TestClient, smtp: TestSmtpServer): Promise<void> {
	const response = await admin.put("/api/settings/email", smtpSettings(smtp.port));
	expect(response.statusCode).toBe(200);
}

/** Waits until `count` messages arrived, e.g. from a flow that sends in the background. */
export function awaitMail(smtp: TestSmtpServer, count = 1): Promise<ReceivedMail[]> {
	return vi.waitFor(
		() => {
			if (smtp.received.length < count) {
				throw new Error(`${smtp.received.length} of ${count} messages received`);
			}
			return smtp.received;
		},
		{ timeout: 5_000, interval: 20 },
	);
}
