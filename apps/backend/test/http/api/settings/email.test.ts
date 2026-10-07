import { describe, expect } from "vitest";
import { ADMIN, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { smtpSettings, startSmtpServer, test } from "../../../support/smtp.js";

describe("GET /api/settings/email", () => {
	test("starts empty, with the instance name as sender", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.get("/api/settings/email");

		expect(response.json()).toEqual({
			enabled: false,
			configured: false,
			host: "",
			port: 587,
			security: "starttls",
			username: null,
			hasPassword: false,
			fromName: "Aegis Test",
			fromAddress: "",
			replyTo: null,
			allowInvalidCertificate: false,
			lastVerifiedAt: null,
			updatedAt: null,
		});
	});

	test("is reserved for admins", async ({ aegis }) => {
		await aegis.setup();
		const user = await aegis.createUser({ role: "admin" });
		const admin = await aegis.signIn(user.email, USER_PASSWORD);
		await aegis.services.users.update(user.id, { role: "user" }, new Date());

		expect((await aegis.client().get("/api/settings/email")).statusCode).toBe(401);
		expect((await admin.get("/api/settings/email")).statusCode).toBe(403);
	});
});

describe("PUT /api/settings/email", () => {
	test("verifies the server before sending is turned on", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();

		const response = await admin.put("/api/settings/email", smtpSettings(smtp.port, { replyTo: "help@aegis.test" }));

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			enabled: true,
			configured: true,
			host: "127.0.0.1",
			port: smtp.port,
			security: "none",
			hasPassword: false,
			replyTo: "help@aegis.test",
			lastVerifiedAt: expect.any(String),
		});
		expect(aegis.services.email.isEnabled()).toBe(true);
		expect((await aegis.client().get("/api/instance")).json().passwordResetEnabled).toBe(true);
		expect(await auditEvents(aegis, "email.settings.updated")).toHaveLength(1);
		expect(await auditEvents(aegis, "email.settings.enabled")).toHaveLength(1);
	});

	test("reports the server's reply when it cannot be reached", async ({ aegis }) => {
		const admin = await aegis.setup();
		const closed = await startSmtpServer();
		await closed.close();

		const response = await admin.put("/api/settings/email", smtpSettings(closed.port));

		expect(response.statusCode).toBe(502);
		expect(response.json().error).toMatchObject({ code: "smtp_connection_failed", message: expect.stringMatching(/ECONNREFUSED/) });
		expect(aegis.services.email.isEnabled()).toBe(false);
		const [failed] = await auditEvents(aegis, "email.connection.failed");
		expect(failed?.metadata).toMatchObject({ host: "127.0.0.1", port: closed.port, security: "none" });
	});

	test("stores settings without verifying them while sending stays off", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.put("/api/settings/email", smtpSettings(1, { enabled: false }));

		expect(response.json()).toMatchObject({ enabled: false, configured: true, port: 1, lastVerifiedAt: null });
		expect(await auditEvents(aegis, "email.settings.enabled")).toEqual([]);
	});

	test("uses STARTTLS and checks the certificate unless told otherwise", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();

		const strict = await admin.put("/api/settings/email", smtpSettings(smtp.port, { security: "starttls" }));
		expect(strict.statusCode).toBe(502);
		expect(strict.json().error.message).toMatch(/certificate/i);

		const relaxed = await admin.put(
			"/api/settings/email",
			smtpSettings(smtp.port, { security: "starttls", allowInvalidCertificate: true }),
		);
		expect(relaxed.statusCode).toBe(200);
		expect(relaxed.json()).toMatchObject({ security: "starttls", allowInvalidCertificate: true });
	});

	test("speaks TLS from the first byte", async ({ aegis }) => {
		const admin = await aegis.setup();
		const tls = await startSmtpServer({ secure: true });

		try {
			const response = await admin.put(
				"/api/settings/email",
				smtpSettings(tls.port, { security: "tls", allowInvalidCertificate: true }),
			);
			expect(response.statusCode).toBe(200);
		} finally {
			await tls.close();
		}
	});

	test("authenticates, keeps the password to itself and only reuses it for the same server", async ({ aegis }) => {
		const admin = await aegis.setup();
		const server = await startSmtpServer({ credentials: { username: "mailer", password: "s3cret" } });
		const settings = smtpSettings(server.port, { username: "mailer" });

		try {
			const withoutPassword = await admin.put("/api/settings/email", settings);
			expect(withoutPassword.statusCode).toBe(400);
			expect(withoutPassword.json().error.issues).toEqual([{ path: "password", code: "required" }]);

			const wrong = await admin.put("/api/settings/email", { ...settings, password: "wrong" });
			expect(wrong.statusCode).toBe(502);
			expect(wrong.json().error.message).toMatch(/535/);

			const saved = await admin.put("/api/settings/email", { ...settings, password: "s3cret" });
			expect(saved.json()).toMatchObject({ username: "mailer", hasPassword: true });
			expect(JSON.stringify(saved.json())).not.toContain("s3cret");
			const stored = aegis.services.emailSettings.get();
			expect(stored?.passwordCiphertext).toMatch(/^v1\./);
			expect(stored?.passwordCiphertext).not.toContain("s3cret");

			expect((await admin.put("/api/settings/email", settings)).statusCode).toBe(200);
			const moved = await admin.put("/api/settings/email", { ...settings, host: "localhost" });
			expect(moved.statusCode).toBe(400);
			expect(moved.json().error.issues).toEqual([{ path: "password", code: "required" }]);
		} finally {
			await server.close();
		}
	});

	test("forgets the verification of a server that changed while sending stays off", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await admin.put("/api/settings/email", smtpSettings(smtp.port));
		const verified = aegis.services.emailSettings.get()?.lastVerifiedAt;

		const same = await admin.put("/api/settings/email", smtpSettings(smtp.port, { enabled: false }));
		expect(same.json().lastVerifiedAt).toBe(verified?.toISOString());
		const [disabled] = await auditEvents(aegis, "email.settings.disabled");
		expect(disabled).toBeDefined();

		const changed = await admin.put("/api/settings/email", smtpSettings(smtp.port + 1, { enabled: false }));
		expect(changed.json().lastVerifiedAt).toBeNull();
	});
});

describe("POST /api/settings/email/test", () => {
	test("opens a session with the unsaved settings", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();

		const response = await admin.post("/api/settings/email/test", smtpSettings(smtp.port));

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ mode: "verify", durationMs: expect.any(Number), deliveredTo: null });
		expect(aegis.services.emailSettings.get()).toBeNull();
		expect(smtp.received).toEqual([]);
		const [tested] = await auditEvents(aegis, "email.connection.tested");
		expect(tested?.metadata).toMatchObject({ host: "127.0.0.1", durationMs: expect.any(Number) });
	});

	test("delivers a test message to the admin, in the admin's language", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();

		const response = await admin.post(
			"/api/settings/email/test",
			{ ...smtpSettings(smtp.port, { replyTo: "help@aegis.test" }), mode: "send" },
			{
				headers: { "accept-language": "de" },
			},
		);

		expect(response.json()).toMatchObject({ mode: "send", deliveredTo: ADMIN.email });
		const [mail] = smtp.received;
		expect(mail).toMatchObject({ from: "aegis@aegis.test", to: [ADMIN.email], replyTo: "help@aegis.test" });
		expect(mail?.subject).toContain("Aegis Test");
		expect(mail?.text).toContain(`127.0.0.1:${smtp.port}`);
		expect(mail?.headers.get("auto-submitted")).toBe("auto-generated");
		const [sent] = await auditEvents(aegis, "email.sent");
		expect(sent?.metadata).toMatchObject({ template: "email_test", recipient: ADMIN.email, locale: "de" });
	});

	test("reports a message the server refused", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		smtp.rejectNextRecipient();

		const response = await admin.post("/api/settings/email/test", { ...smtpSettings(smtp.port), mode: "send" });

		expect(response.statusCode).toBe(502);
		expect(response.json().error).toMatchObject({ code: "smtp_connection_failed", message: expect.stringMatching(/550/) });
		const [failed] = await auditEvents(aegis, "email.failed");
		expect(failed?.metadata).toMatchObject({ template: "email_test", error: expect.stringMatching(/550/) });
	});

	test("records a failed connection test", async ({ aegis }) => {
		const admin = await aegis.setup();
		const closed = await startSmtpServer();
		await closed.close();

		const response = await admin.post("/api/settings/email/test", smtpSettings(closed.port));

		expect(response.statusCode).toBe(502);
		expect(await auditEvents(aegis, "email.connection.failed")).toHaveLength(1);
	});
});
