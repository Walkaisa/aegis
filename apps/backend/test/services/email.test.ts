import type { EmailPayload } from "@aegis/email";
import { describe, expect, vi } from "vitest";
import { ADMIN, test } from "../support/aegis.js";
import { awaitMail, enableEmail, smtpSettings, startSmtpServer, test as withSmtp } from "../support/smtp.js";

const testPayload = (recipient: string): EmailPayload => ({
	template: "email_test",
	data: { displayName: "Ada", recipient, sentAt: new Date(), server: "smtp", security: "none", sender: "aegis@aegis.test" },
});

describe("EmailService", () => {
	test("refuses to send while sending is off", async ({ aegis }) => {
		const log = vi.spyOn(aegis.app.log, "error");

		await expect(aegis.services.email.send(testPayload(ADMIN.email), "en")).rejects.toMatchObject({ code: "email_not_configured" });
		expect(await aegis.services.email.deliver(testPayload(ADMIN.email), "en")).toBe(false);
		expect(log).not.toHaveBeenCalled();
	});

	withSmtp("logs messages that cannot be rendered", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const log = vi.spyOn(aegis.app.log, "error");

		const broken = { template: "password_reset", data: null } as unknown as EmailPayload;
		expect(await aegis.services.email.deliver(broken, "en")).toBe(false);

		expect(log).toHaveBeenCalledWith({ err: expect.any(Error), template: "password_reset" }, "Rendering an e-mail failed");
	});

	withSmtp("signs messages with Aegis when the instance has no name", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		vi.spyOn(aegis.services.settings, "get").mockReturnValue(null);

		await aegis.services.email.send(testPayload(ADMIN.email), "en");

		const [mail] = await awaitMail(smtp);
		expect(mail?.subject).toContain("Aegis");
	});

	test("authenticates with the stored password when sending", async ({ aegis }) => {
		const admin = await aegis.setup();
		const server = await startSmtpServer({ credentials: { username: "mailer", password: "s3cret" } });
		try {
			expect(
				(await admin.put("/api/settings/email", smtpSettings(server.port, { username: "mailer", password: "s3cret" }))).statusCode,
			).toBe(200);

			await aegis.services.email.send(testPayload(ADMIN.email), "en");

			expect(await awaitMail(server)).toHaveLength(1);
		} finally {
			await server.close();
		}
	});
});
