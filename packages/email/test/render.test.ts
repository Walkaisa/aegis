import { SUPPORTED_LOCALES } from "@aegis/contracts";
import { describe, expect, it } from "vitest";
import { messagesFor } from "../src/messages/index";
import { type EmailPayload, renderEmail } from "../src/render";

const brand = { instanceName: "Acme Login", issuer: "https://auth.acme.test" };
const requestedAt = new Date(Date.UTC(2026, 8, 27, 10, 30));
const firefoxOnWindows = { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 (Windows NT 10.0; rv:140.0) Gecko/20100101 Firefox/140.0" };

const payloads: EmailPayload[] = [
	{
		template: "password_reset",
		data: {
			displayName: "Ada",
			recipient: "ada@acme.test",
			url: "https://auth.acme.test/reset-password#token=abc",
			requestedAt,
			expiresAt: new Date(requestedAt.getTime() + 60 * 60_000),
			origin: firefoxOnWindows,
		},
	},
	{
		template: "password_changed",
		data: { displayName: "Ada", recipient: "ada@acme.test", changedAt: requestedAt, origin: { ipAddress: null, userAgent: null } },
	},
	{
		template: "email_change_confirm",
		data: {
			displayName: "Ada",
			recipient: "new@acme.test",
			currentEmail: "ada@acme.test",
			url: "https://auth.acme.test/verify-email#token=def",
			requestedAt,
			expiresAt: new Date(requestedAt.getTime() + 24 * 60 * 60_000),
			origin: { ipAddress: "203.0.113.7", userAgent: "curl/8.9.1" },
		},
	},
	{
		template: "email_change_notice",
		data: {
			displayName: "Ada",
			recipient: "ada@acme.test",
			newEmail: "new@acme.test",
			requestedAt,
			origin: { ipAddress: "203.0.113.7", userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
		},
	},
	{
		template: "email_test",
		data: {
			displayName: "Ada",
			recipient: "ada@acme.test",
			sentAt: requestedAt,
			server: "smtp.acme.test:587",
			security: "starttls",
			sender: "Acme Login <auth@acme.test>",
		},
	},
];

describe("renderEmail", () => {
	for (const locale of SUPPORTED_LOCALES) {
		for (const payload of payloads) {
			it(`renders ${payload.template} in ${locale}`, async () => {
				const email = await renderEmail(payload, { brand, locale });

				expect(email.recipient).toBe(payload.data.recipient);
				expect(email.subject).toContain(brand.instanceName);
				expect(email.html).toMatch(/^<!DOCTYPE html/);
				expect(email.html).toContain(`lang="${locale}"`);
				expect(email.html).toContain(`${brand.issuer}/icons/icon-96.png`);
				expect(email.text).toContain(brand.instanceName);
				expect(email.text).not.toMatch(/<\/?(?:html|table|td|p|div|a)\b/);
				if ("url" in payload.data) {
					expect(email.html).toContain(payload.data.url);
					expect(email.text).toContain(payload.data.url);
				}
			});
		}
	}

	it("describes the device a request came from", async () => {
		const [reset, changed, confirm, notice] = await Promise.all(
			payloads.slice(0, 4).map((payload) => renderEmail(payload, { brand, locale: "en" })),
		);
		expect(reset?.text).toContain("Firefox on Windows");
		expect(reset?.text).toContain("203.0.113.7");
		expect(changed?.text).toMatch(/IP address\s+Unknown/);
		expect(confirm?.text).toContain("curl");
		expect(notice?.text).toContain("Linux");
	});

	it("names the encryption of the tested connection", async () => {
		for (const security of ["starttls", "tls", "none"] as const) {
			const payload = payloads[4] as Extract<EmailPayload, { template: "email_test" }>;
			const email = await renderEmail({ ...payload, data: { ...payload.data, security } }, { brand, locale: "de" });
			expect(email.text).toContain(messagesFor("de").encryption[security]);
		}
	});
});
