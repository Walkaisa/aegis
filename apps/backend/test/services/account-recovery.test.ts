import type { UserRecord } from "@aegis/db";
import { describe, expect, vi } from "vitest";
import { ADMIN, NO_ORIGIN } from "../support/aegis.js";
import { auditEvents } from "../support/audit.js";
import { awaitMail, enableEmail, test as withSmtp } from "../support/smtp.js";

describe("AccountRecoveryService", () => {
	withSmtp("hides all but the first letter of short addresses", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		await aegis.createUser({ email: "ab@aegis.test" });

		await aegis.services.recovery.requestPasswordReset("ab@aegis.test", "en", NO_ORIGIN);
		const [mail] = await awaitMail(smtp);

		expect((await aegis.services.recovery.validatePasswordReset(smtp.tokenOf(mail))).maskedEmail).toBe("a••@aegis.test");
	});

	withSmtp("refuses a reset link that another request redeemed in the meantime", async ({ aegis, smtp }) => {
		await enableEmail(await aegis.setup(), smtp);
		await aegis.services.recovery.requestPasswordReset(ADMIN.email, "en", NO_ORIGIN);
		const token = smtp.tokenOf((await awaitMail(smtp))[0]);

		// The link was still open when it was looked up, but the other request spent it first.
		vi.spyOn(aegis.services.accountTokens, "consume").mockResolvedValueOnce(false);
		await expect(aegis.services.recovery.completePasswordReset(token, "a new password for ada", "en", NO_ORIGIN)).rejects.toMatchObject(
			{
				code: "verification_token_invalid",
			},
		);

		expect(await aegis.services.auth.verifyPassword(ADMIN.email, ADMIN.password, NO_ORIGIN, { context: "admin" })).toBeTruthy();
	});

	withSmtp("rethrows failures that are not a race for the address", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const user = (await aegis.services.users.findByEmail(ADMIN.email)) as UserRecord;

		vi.spyOn(aegis.services.accountTokens, "insert").mockRejectedValueOnce(new Error("disk full"));
		await expect(aegis.services.recovery.startEmailChange(user, "new@aegis.test", "en", NO_ORIGIN)).rejects.toThrow("disk full");

		await aegis.services.recovery.startEmailChange(user, "new@aegis.test", "en", NO_ORIGIN);
		const [confirmation] = (await awaitMail(smtp, 2)).filter((mail) => mail.to.includes("new@aegis.test"));
		vi.spyOn(aegis.services.users, "update").mockRejectedValueOnce(new Error("disk full"));
		await expect(aegis.services.recovery.confirmEmailChange(smtp.tokenOf(confirmation), NO_ORIGIN)).rejects.toThrow("disk full");
	});

	withSmtp("refuses a confirmation link that was redeemed concurrently or names no address", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const user = (await aegis.services.users.findByEmail(ADMIN.email)) as UserRecord;
		await aegis.services.recovery.startEmailChange(user, "new@aegis.test", "en", NO_ORIGIN);
		const [confirmation] = (await awaitMail(smtp, 2)).filter((mail) => mail.to.includes("new@aegis.test"));
		const token = smtp.tokenOf(confirmation);

		vi.spyOn(aegis.services.accountTokens, "consume").mockResolvedValueOnce(false);
		await expect(aegis.services.recovery.confirmEmailChange(token, NO_ORIGIN)).rejects.toMatchObject({
			code: "verification_token_invalid",
		});

		const find = aegis.services.accountTokens.find.bind(aegis.services.accountTokens);
		vi.spyOn(aegis.services.accountTokens, "find").mockImplementationOnce(async (...args) => {
			const found = await find(...args);
			return found && { ...found, token: { ...found.token, targetEmail: null } };
		});
		await expect(aegis.services.recovery.confirmEmailChange(token, NO_ORIGIN)).rejects.toMatchObject({
			code: "verification_token_invalid",
		});
		const [failed] = await auditEvents(aegis, "user.email_change_failed");
		expect(failed?.metadata.reason).toBe("invalid_token");
		expect((await aegis.services.users.findById(user.id))?.email).toBe(ADMIN.email);
	});
});
