import { afterEach, describe, expect, vi } from "vitest";
import { ADMIN, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents, awaitAuditEvent, awaitAuditEvents } from "../../../support/audit.js";
import { awaitMail, enableEmail, test } from "../../../support/smtp.js";

afterEach(() => {
	vi.useRealTimers();
});

describe("password reset", () => {
	test("is unavailable without an e-mail server", async ({ aegis }) => {
		await aegis.setup();

		const response = await aegis.client().post("/api/auth/password-reset", { email: ADMIN.email });

		expect(response.statusCode).toBe(409);
		expect(response.json().error.code).toBe("email_not_configured");
	});

	test("sends a single-use link that sets a new password and ends every session", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const visitor = aegis.client();

		const requested = await visitor.post(
			"/api/auth/password-reset",
			{ email: ADMIN.email.toUpperCase() },
			{ headers: { "accept-language": "de" } },
		);
		expect(requested.statusCode).toBe(202);
		const [mail] = await awaitMail(smtp);
		expect(mail?.to).toEqual([ADMIN.email]);
		expect(mail?.text).toContain("http://localhost:3000/reset-password#token=");
		const token = smtp.tokenOf(mail ?? smtp.received[0]);

		const validated = await visitor.post("/api/auth/password-reset/validate", { token });
		expect(validated.json()).toEqual({
			maskedEmail: "ad•••@aegis.test",
			displayName: ADMIN.displayName,
			expiresAt: expect.any(String),
		});

		const confirmed = await visitor.post(
			"/api/auth/password-reset/confirm",
			{ token, password: "a brand new password" },
			{ headers: { "accept-language": "de" } },
		);
		expect(confirmed.statusCode).toBe(204);
		expect((await admin.get("/api/auth/session")).statusCode).toBe(401);
		expect((await aegis.client().post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password })).statusCode).toBe(401);
		expect((await aegis.client().post("/api/auth/session", { email: ADMIN.email, password: "a brand new password" })).statusCode).toBe(
			201,
		);

		const [, notice] = await awaitMail(smtp, 2);
		expect(notice?.subject).toMatch(/Passwort/);
		expect(
			(await visitor.post("/api/auth/password-reset/confirm", { token, password: "yet another password" })).json().error.code,
		).toBe("verification_token_invalid");
		expect((await visitor.post("/api/auth/password-reset/validate", { token })).statusCode).toBe(400);
		const [failed] = await auditEvents(aegis, "auth.password_reset.failed");
		expect(failed?.metadata).toEqual({ reason: "already_used" });
		expect(await auditEvents(aegis, "auth.password_reset.completed")).toHaveLength(1);
	});

	test("answers the same for unknown and disabled accounts without sending anything", async ({ aegis, smtp }) => {
		await enableEmail(await aegis.setup(), smtp);
		const disabled = await aegis.createUser({ enabled: false });

		expect((await aegis.client().post("/api/auth/password-reset", { email: "nobody@aegis.test" })).statusCode).toBe(202);
		expect((await aegis.client().post("/api/auth/password-reset", { email: disabled.email })).statusCode).toBe(202);

		const requests = await awaitAuditEvents(aegis, "auth.password_reset.requested", 2);
		const reasons = requests.map((event) => event.metadata.reason).sort();
		expect(reasons).toEqual(["account_disabled", "unknown_email"]);
		expect(smtp.received).toEqual([]);
	});

	test("does not send a second link right after the first", async ({ aegis, smtp }) => {
		await enableEmail(await aegis.setup(), smtp);

		await aegis.client().post("/api/auth/password-reset", { email: ADMIN.email });
		// The first request is recorded once the mail server accepted the message.
		await awaitAuditEvent(aegis, "auth.password_reset.requested");
		await aegis.client().post("/api/auth/password-reset", { email: ADMIN.email });

		const [latest] = await awaitAuditEvents(aegis, "auth.password_reset.requested", 2);
		expect(latest?.metadata).toMatchObject({ delivered: false, reason: "throttled" });
		expect(smtp.received).toHaveLength(1);
	});

	test("withdraws a link that could not be delivered", async ({ aegis, smtp }) => {
		await enableEmail(await aegis.setup(), smtp);
		smtp.rejectNextRecipient();

		await aegis.client().post("/api/auth/password-reset", { email: ADMIN.email });

		const event = await awaitAuditEvent(aegis, "auth.password_reset.requested");
		expect(event.metadata).toMatchObject({ delivered: false, reason: "delivery_failed" });
		expect(await auditEvents(aegis, "email.failed")).toHaveLength(1);
		const admin = await aegis.services.users.findByEmail(ADMIN.email);
		expect(await aegis.services.accountTokens.findOpenForUser(admin?.id ?? "", "password_reset", new Date())).toBeNull();
	});

	test("rejects unknown, expired and disabled links", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const visitor = aegis.client();

		const unknown = await visitor.post("/api/auth/password-reset/confirm", { token: "unknown", password: "a brand new password" });
		expect(unknown.json().error.code).toBe("verification_token_invalid");

		await visitor.post("/api/auth/password-reset", { email: ADMIN.email });
		const token = smtp.tokenOf((await awaitMail(smtp))[0]);
		const account = await aegis.services.users.findByEmail(ADMIN.email);
		const other = await aegis.createUser({ role: "admin" });
		await aegis.services.users.update(account?.id ?? "", { enabled: false }, new Date());
		expect((await visitor.post("/api/auth/password-reset/confirm", { token, password: "a brand new password" })).statusCode).toBe(400);
		await aegis.services.users.update(account?.id ?? "", { enabled: true }, new Date());

		vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 61 * 60_000 });
		expect((await visitor.post("/api/auth/password-reset/confirm", { token, password: "a brand new password" })).statusCode).toBe(400);
		vi.useRealTimers();

		const reasons = (await auditEvents(aegis, "auth.password_reset.failed")).map((event) => event.metadata.reason);
		expect(reasons).toEqual(["expired", "account_disabled", "invalid_token"]);
		expect(other.role).toBe("admin");
	});

	test("rejects a weak new password without spending the link", async ({ aegis, smtp }) => {
		await enableEmail(await aegis.setup(), smtp);
		await aegis.client().post("/api/auth/password-reset", { email: ADMIN.email });
		const token = smtp.tokenOf((await awaitMail(smtp))[0]);

		const weak = await aegis.client().post("/api/auth/password-reset/confirm", { token, password: "short" });

		expect(weak.json().error.issues).toEqual([{ path: "password", code: "password_too_short" }]);
		expect((await aegis.client().post("/api/auth/password-reset/validate", { token })).statusCode).toBe(200);
	});

	test("lets only the first of two concurrent redemptions through", async ({ aegis, smtp }) => {
		await enableEmail(await aegis.setup(), smtp);
		await aegis.client().post("/api/auth/password-reset", { email: ADMIN.email });
		const token = smtp.tokenOf((await awaitMail(smtp))[0]);

		const results = await Promise.all([
			aegis.client().post("/api/auth/password-reset/confirm", { token, password: "first new password" }),
			aegis.client().post("/api/auth/password-reset/confirm", { token, password: "second new password" }),
		]);

		expect(results.map((response) => response.statusCode).sort()).toEqual([204, 400]);
	});
});

describe("e-mail change", () => {
	test("confirms a new address from its mailbox before it takes effect", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);

		const requested = await admin.put("/api/account", {
			displayName: ADMIN.displayName,
			email: "new@aegis.test",
			currentPassword: ADMIN.password,
		});

		expect(requested.json()).toMatchObject({
			account: { email: ADMIN.email },
			pendingEmailChange: { email: "new@aegis.test", requestedAt: expect.any(String), expiresAt: expect.any(String) },
		});
		const [confirmation, notice] = await awaitMail(smtp, 2);
		expect(confirmation?.to).toEqual(["new@aegis.test"]);
		expect(confirmation?.text).toContain("http://localhost:3000/verify-email#token=");
		expect(notice?.to).toEqual([ADMIN.email]);
		expect(notice?.text).toContain("new@aegis.test");

		const confirmed = await aegis.client().post("/api/auth/email-change/confirm", { token: smtp.tokenOf(confirmation) });

		expect(confirmed.json()).toEqual({ email: "new@aegis.test" });
		expect((await admin.get("/api/account")).json()).toMatchObject({ account: { email: "new@aegis.test" }, pendingEmailChange: null });
		const [event] = await auditEvents(aegis, "user.email_change_confirmed");
		expect(event?.metadata).toEqual({ from: ADMIN.email, to: "new@aegis.test" });
	});

	test("can be sent again and cancelled", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		await admin.put("/api/account", { displayName: ADMIN.displayName, email: "new@aegis.test", currentPassword: ADMIN.password });
		const first = smtp.tokenOf((await awaitMail(smtp, 2))[0]);

		const resent = await admin.post("/api/account/email-change/resend");
		expect(resent.json().pendingEmailChange.email).toBe("new@aegis.test");
		const second = smtp.tokenOf((await awaitMail(smtp, 4))[2]);
		expect((await aegis.client().post("/api/auth/email-change/confirm", { token: first })).statusCode).toBe(400);

		const cancelled = await admin.delete("/api/account/email-change");
		expect(cancelled.json().pendingEmailChange).toBeNull();
		expect((await aegis.client().post("/api/auth/email-change/confirm", { token: second })).statusCode).toBe(400);
		expect((await admin.post("/api/account/email-change/resend")).statusCode).toBe(404);
		expect((await admin.delete("/api/account/email-change")).statusCode).toBe(200);
		expect(await auditEvents(aegis, "user.email_change_cancelled")).toHaveLength(1);
		const reasons = (await auditEvents(aegis, "user.email_change_failed")).map((event) => event.metadata.reason);
		expect(reasons).toEqual(["invalid_token", "invalid_token"]);
	});

	test("keeps an address that belongs to someone else, now or by the time the link is clicked", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const other = await aegis.createUser();

		const taken = await admin.put("/api/account", {
			displayName: ADMIN.displayName,
			email: other.email,
			currentPassword: ADMIN.password,
		});
		expect(taken.json().error.code).toBe("email_taken");

		await admin.put("/api/account", { displayName: ADMIN.displayName, email: "wanted@aegis.test", currentPassword: ADMIN.password });
		const token = smtp.tokenOf((await awaitMail(smtp, 2))[0]);
		await aegis.services.users.update(other.id, { email: "wanted@aegis.test", emailNormalized: "wanted@aegis.test" }, new Date());

		const confirmed = await aegis.client().post("/api/auth/email-change/confirm", { token });
		expect(confirmed.statusCode).toBe(409);
		expect(confirmed.json().error.code).toBe("email_taken");
		const [failed] = await auditEvents(aegis, "user.email_change_failed");
		expect(failed?.metadata).toEqual({ reason: "email_taken" });
		expect((await admin.get("/api/account")).json().pendingEmailChange).toBeNull();
	});

	test("reserves an address for the account that asked for it first", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const otherUser = await aegis.createUser({ role: "admin" });
		const other = await aegis.signIn(otherUser.email, USER_PASSWORD);

		await admin.put("/api/account", { displayName: ADMIN.displayName, email: "wanted@aegis.test", currentPassword: ADMIN.password });
		const second = await other.put("/api/account", {
			displayName: "Other",
			email: "wanted@aegis.test",
			currentPassword: USER_PASSWORD,
		});

		expect(second.statusCode).toBe(409);
		expect(second.json().error.code).toBe("email_change_pending");
	});

	test("withdraws a confirmation link that could not be delivered", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		smtp.rejectNextRecipient();

		const response = await admin.put("/api/account", {
			displayName: ADMIN.displayName,
			email: "new@aegis.test",
			currentPassword: ADMIN.password,
		});

		expect(response.statusCode).toBe(502);
		expect(response.json().error.code).toBe("email_delivery_failed");
		expect((await admin.get("/api/account")).json().pendingEmailChange).toBeNull();
	});

	test("rejects expired links", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		await admin.put("/api/account", { displayName: ADMIN.displayName, email: "new@aegis.test", currentPassword: ADMIN.password });
		const token = smtp.tokenOf((await awaitMail(smtp, 2))[0]);

		vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 25 * 60 * 60_000 });
		const response = await aegis.client().post("/api/auth/email-change/confirm", { token });

		expect(response.statusCode).toBe(400);
		const [failed] = await auditEvents(aegis, "user.email_change_failed");
		expect(failed?.metadata).toEqual({ reason: "expired" });
	});
});
