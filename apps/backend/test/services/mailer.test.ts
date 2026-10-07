import { describe, expect, it } from "vitest";
import { describeSmtpError, Mailer } from "../../src/services/mailer.js";
import { startSmtpServer } from "../support/smtp.js";

describe("describeSmtpError", () => {
	it("keeps the code and the reply of the server on one short line", () => {
		const refused = Object.assign(new Error("Invalid login"), { code: "EAUTH", response: "535 5.7.8  Authentication\r\n failed" });

		expect(describeSmtpError(refused)).toBe("EAUTH: 535 5.7.8 Authentication failed");
		expect(describeSmtpError(new Error("x".repeat(400)))).toHaveLength(300);
		expect(describeSmtpError("timeout")).toBe("The e-mail server could not be reached");
	});
});

describe("Mailer", () => {
	it("sends a user name without a password as an empty password", async () => {
		const server = await startSmtpServer({ credentials: { username: "mailer", password: "s3cret" } });
		try {
			const connection = {
				host: "127.0.0.1",
				port: server.port,
				security: "none" as const,
				username: "mailer",
				password: null,
				fromName: "Aegis",
				fromAddress: "aegis@aegis.test",
				replyTo: null,
				allowInvalidCertificate: false,
			};

			await expect(new Mailer().verify(connection)).rejects.toMatchObject({ code: "EAUTH" });
		} finally {
			await server.close();
		}
	});
});
