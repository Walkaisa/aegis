import { describe, expect } from "vitest";
import { ADMIN } from "../../support/aegis.js";
import { auditEvents } from "../../support/audit.js";
import { testImage } from "../../support/images.js";
import { awaitMail, enableEmail, test } from "../../support/smtp.js";
import { enableTwoFactor, totpCode } from "../../support/two-factor.js";

describe("GET /api/account", () => {
	test("is the signed-in admin's own account", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.get("/api/account");

		expect(response.json()).toMatchObject({ account: { email: ADMIN.email, twoFactorEnabled: false }, pendingEmailChange: null });
		expect((await aegis.client().get("/api/account")).statusCode).toBe(401);
	});
});

describe("PUT /api/account", () => {
	test("changes the display name without the password", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.put("/api/account", { displayName: " Ada L. ", email: ADMIN.email });

		expect(response.json().account.displayName).toBe("Ada L.");
		const [event] = await auditEvents(aegis, "user.updated");
		expect(event?.metadata).toEqual({ emailChanged: false });
	});

	test("leaves an unchanged profile alone", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.put("/api/account", { displayName: ADMIN.displayName, email: ADMIN.email })).statusCode).toBe(200);
		expect(await auditEvents(aegis, "user.updated")).toEqual([]);
	});

	test("changes the e-mail address right away without an e-mail server, but only with the password", async ({ aegis }) => {
		const admin = await aegis.setup();
		const change = { displayName: ADMIN.displayName, email: "ada@new.test" };

		expect((await admin.put("/api/account", change)).json().error.code).toBe("invalid_current_password");
		expect((await admin.put("/api/account", { ...change, currentPassword: "wrong" })).json().error.code).toBe(
			"invalid_current_password",
		);
		const response = await admin.put("/api/account", { ...change, currentPassword: ADMIN.password });

		expect(response.json()).toMatchObject({ account: { email: "ada@new.test" }, pendingEmailChange: null });
		const [event] = await auditEvents(aegis, "user.updated");
		expect(event?.metadata).toEqual({ emailChanged: true });
	});

	test("rejects an address another account uses", async ({ aegis }) => {
		const admin = await aegis.setup();
		const other = await aegis.createUser();

		const response = await admin.put("/api/account", {
			displayName: ADMIN.displayName,
			email: other.email,
			currentPassword: ADMIN.password,
		});

		expect(response.statusCode).toBe(409);
		expect(response.json().error.code).toBe("email_taken");
	});

	test("keeps the display name change while the new address waits for its confirmation", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);

		const response = await admin.put("/api/account", {
			displayName: "Ada New",
			email: "ada@new.test",
			currentPassword: ADMIN.password,
		});

		expect(response.json()).toMatchObject({
			account: { displayName: "Ada New", email: ADMIN.email },
			pendingEmailChange: { email: "ada@new.test" },
		});
		const [event] = await auditEvents(aegis, "user.updated");
		expect(event?.metadata).toEqual({ emailChanged: false });
		await awaitMail(smtp, 2);
	});
});

describe("POST /api/account/password", () => {
	test("changes the password, keeps this session and ends the others", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const elsewhere = await aegis.signIn(ADMIN.email, ADMIN.password);

		const response = await admin.post("/api/account/password", {
			currentPassword: ADMIN.password,
			newPassword: "an even better password",
		});

		expect(response.statusCode).toBe(204);
		expect((await admin.get("/api/auth/session")).statusCode).toBe(200);
		expect((await elsewhere.get("/api/auth/session")).statusCode).toBe(401);
		const [notice] = await awaitMail(smtp);
		expect(notice?.to).toEqual([ADMIN.email]);
		expect(await auditEvents(aegis, "user.password_changed")).toHaveLength(1);
	});

	test("requires the current password", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.post("/api/account/password", { currentPassword: "wrong", newPassword: "an even better password" });

		expect(response.statusCode).toBe(400);
		expect(response.json().error.code).toBe("invalid_current_password");
	});
});

describe("two-factor authentication", () => {
	test("reports its status", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.get("/api/account/two-factor")).json()).toEqual({
			twoFactor: { enabled: false, enabledAt: null, label: null, recoveryCodesRemaining: 0 },
		});
		await enableTwoFactor(admin);
		expect((await admin.get("/api/account/two-factor")).json()).toEqual({
			twoFactor: { enabled: true, enabledAt: expect.any(String), label: "Phone", recoveryCodesRemaining: 10 },
		});
	});

	test("starts the setup with the password and an otpauth URI for the instance", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await admin.post("/api/account/two-factor/setup", { currentPassword: "wrong" })).json().error.code).toBe(
			"invalid_current_password",
		);
		const response = await admin.post("/api/account/two-factor/setup", { currentPassword: ADMIN.password });

		expect(response.json()).toMatchObject({ issuer: "Aegis Test", accountName: ADMIN.email, digits: 6, period: 30 });
		expect(response.json().otpauthUri).toMatch(/^otpauth:\/\/totp\/Aegis%20Test:admin%40aegis\.test\?/);
		expect(response.json().secret).toMatch(/^[A-Z2-7]{32}$/);
	});

	test("is confirmed with a first code, which ends the other sessions", async ({ aegis }) => {
		const admin = await aegis.setup();
		const elsewhere = await aegis.signIn(ADMIN.email, ADMIN.password);

		expect((await admin.post("/api/account/two-factor", { code: "123456" })).json().error.code).toBe("two_factor_setup_required");
		const { secret } = (await admin.post("/api/account/two-factor/setup", { currentPassword: ADMIN.password })).json();
		expect((await admin.post("/api/account/two-factor", { code: "000000" })).json().error.code).toBe("second_factor_invalid");
		const enabled = await admin.post("/api/account/two-factor", { code: totpCode(secret) });

		expect(enabled.json().codes).toHaveLength(10);
		expect(enabled.json().twoFactor).toMatchObject({ enabled: true, label: null });
		expect((await elsewhere.get("/api/auth/session")).statusCode).toBe(401);
		expect((await admin.get("/api/auth/session")).statusCode).toBe(200);
		expect((await admin.post("/api/account/two-factor/setup", { currentPassword: ADMIN.password })).json().error.code).toBe(
			"two_factor_already_enabled",
		);
		expect((await admin.post("/api/account/two-factor", { code: totpCode(secret, 1) })).json().error.code).toBe(
			"two_factor_already_enabled",
		);
		expect(await auditEvents(aegis, "user.two_factor_enabled")).toHaveLength(1);
	});

	test("discards an unconfirmed setup, but never an active one", async ({ aegis }) => {
		const admin = await aegis.setup();
		await admin.post("/api/account/two-factor/setup", { currentPassword: ADMIN.password });

		expect((await admin.delete("/api/account/two-factor/setup")).statusCode).toBe(204);
		expect((await admin.post("/api/account/two-factor", { code: "123456" })).json().error.code).toBe("two_factor_setup_required");

		await enableTwoFactor(admin);
		expect((await admin.delete("/api/account/two-factor/setup")).statusCode).toBe(204);
		expect((await admin.get("/api/account/two-factor")).json().twoFactor.enabled).toBe(true);
	});

	test("is turned off with the password and a code, including a recovery code", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect(
			(await admin.post("/api/account/two-factor/disable", { currentPassword: ADMIN.password, code: "123456" })).json().error.code,
		).toBe("two_factor_not_enabled");
		const { codes } = await enableTwoFactor(admin);
		expect((await admin.post("/api/account/two-factor/disable", { currentPassword: "wrong", code: codes[0] })).json().error.code).toBe(
			"invalid_current_password",
		);
		expect(
			(await admin.post("/api/account/two-factor/disable", { currentPassword: ADMIN.password, code: "AAAAA-AAAAA" })).json().error
				.code,
		).toBe("second_factor_invalid");
		const disabled = await admin.post("/api/account/two-factor/disable", { currentPassword: ADMIN.password, code: codes[0] });

		expect(disabled.json()).toEqual({ twoFactor: { enabled: false, enabledAt: null, label: null, recoveryCodesRemaining: 0 } });
		expect(await auditEvents(aegis, "user.two_factor_disabled")).toHaveLength(1);
	});

	test("replaces the recovery codes", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect(
			(await admin.post("/api/account/two-factor/recovery-codes", { currentPassword: ADMIN.password, code: "123456" })).json().error
				.code,
		).toBe("two_factor_not_enabled");
		const { secret, codes } = await enableTwoFactor(admin);
		expect(
			(await admin.post("/api/account/two-factor/recovery-codes", { currentPassword: ADMIN.password, code: "000000" })).json().error
				.code,
		).toBe("second_factor_invalid");
		const regenerated = await admin.post("/api/account/two-factor/recovery-codes", {
			currentPassword: ADMIN.password,
			code: totpCode(secret, 1),
		});

		expect(regenerated.json().codes).toHaveLength(10);
		expect(regenerated.json().codes).not.toContain(codes[1]);
		expect(
			(await admin.post("/api/account/two-factor/disable", { currentPassword: ADMIN.password, code: codes[1] })).json().error.code,
		).toBe("second_factor_invalid");
		expect(await auditEvents(aegis, "user.recovery_codes_regenerated")).toHaveLength(1);
	});
});

describe("profile picture", () => {
	test("is stored as a normalized WebP served under a content-hashed URL", async ({ aegis }) => {
		const admin = await aegis.setup();

		const uploaded = await admin.request("PUT", "/api/account/avatar", {
			headers: { "content-type": "image/jpeg" },
			payload: await testImage("jpeg"),
		});

		const avatarUrl = uploaded.json().account.avatarUrl as string;
		expect(avatarUrl).toMatch(/^\/api\/media\/avatars\/\d+\/[0-9a-f]{32}\.webp$/);
		const image = await aegis.client().get(avatarUrl);
		expect(image.statusCode).toBe(200);
		expect(image.headers).toMatchObject({
			"content-type": "image/webp",
			"cache-control": "public, max-age=31536000, immutable",
			"cross-origin-resource-policy": "cross-origin",
		});
		expect(image.rawPayload.subarray(8, 12).toString()).toBe("WEBP");
		expect(await auditEvents(aegis, "user.avatar_updated")).toHaveLength(1);

		const removed = await admin.delete("/api/account/avatar");
		expect(removed.json().account.avatarUrl).toBeNull();
		expect((await aegis.client().get(avatarUrl)).statusCode).toBe(404);
		expect((await admin.delete("/api/account/avatar")).statusCode).toBe(200);
		expect(await auditEvents(aegis, "user.avatar_removed")).toHaveLength(1);
	});

	test("rejects anything that is not a supported image", async ({ aegis }) => {
		const admin = await aegis.setup();

		const json = await admin.put("/api/account/avatar", { image: "data" });
		const empty = await admin.request("PUT", "/api/account/avatar", {
			headers: { "content-type": "image/png" },
			payload: Buffer.alloc(0),
		});
		const fake = await admin.request("PUT", "/api/account/avatar", {
			headers: { "content-type": "image/png" },
			payload: Buffer.from("not an image"),
		});
		const gif = await admin.request("PUT", "/api/account/avatar", {
			headers: { "content-type": "image/gif" },
			payload: Buffer.from("GIF89a"),
		});
		const huge = await admin.request("PUT", "/api/account/avatar", {
			headers: { "content-type": "image/png" },
			payload: Buffer.alloc(5 * 1024 * 1024 + 1),
		});

		expect([json.statusCode, empty.statusCode, fake.statusCode, gif.statusCode, huge.statusCode]).toEqual([415, 415, 400, 415, 413]);
		expect(fake.json().error.code).toBe("invalid_image");
		expect(huge.json().error.code).toBe("payload_too_large");
	});

	test("only resolves the current picture of an account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const first = (
			await admin.request("PUT", "/api/account/avatar", {
				headers: { "content-type": "image/png" },
				payload: await testImage("png", 10),
			})
		).json().account.avatarUrl as string;
		await admin.request("PUT", "/api/account/avatar", {
			headers: { "content-type": "image/webp" },
			payload: await testImage("webp", 200),
		});

		expect((await aegis.client().get(first)).statusCode).toBe(404);
		expect((await aegis.client().get("/api/media/avatars/1/nothex.webp")).statusCode).toBe(400);
		expect((await aegis.client().get("/api/media/logos/1/0123456789abcdef0123456789abcdef.webp")).statusCode).toBe(404);
	});
});
