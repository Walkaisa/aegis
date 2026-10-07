import { describe, expect, it } from "vitest";
import { emailSettingsSchema, emailTestSchema } from "../src/email";
import { issueCodes } from "./support/issues";

describe("emailSettingsSchema", () => {
	it("reads blank optional SMTP fields as unset", () => {
		const settings = {
			enabled: true,
			host: "smtp.example.com",
			port: 587,
			security: "starttls",
			username: "  ",
			fromName: "Aegis",
			fromAddress: "aegis@example.com",
			replyTo: "",
		};
		expect(emailSettingsSchema.parse(settings)).toMatchObject({ username: null, replyTo: null, allowInvalidCertificate: false });
		expect(emailSettingsSchema.parse({ ...settings, username: " mailer ", replyTo: "help@example.com" })).toMatchObject({
			username: "mailer",
			replyTo: "help@example.com",
		});
		expect(emailTestSchema.parse(settings).mode).toBe("verify");
	});

	it("rejects host names with a scheme, port or path", () => {
		for (const host of ["smtp://mail", "mail:25", "mail/x", "user@mail", "a b"]) {
			expect(issueCodes(emailSettingsSchema.shape.host, host)).toEqual(["smtp_host_invalid"]);
		}
		expect(issueCodes(emailSettingsSchema.shape.port, 0)).toEqual(["out_of_range"]);
		expect(issueCodes(emailSettingsSchema.shape.port, 1.5)).toEqual(["invalid"]);
	});
});
