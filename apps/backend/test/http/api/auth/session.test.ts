import { afterEach, describe, expect, vi } from "vitest";
import { PasswordHasher } from "../../../../src/crypto/passwords.js";
import { sha256 } from "../../../../src/crypto/tokens.js";
import { ADMIN, test, USER_PASSWORD } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { enableTwoFactor, totpCode } from "../../../support/two-factor.js";

afterEach(() => {
	vi.useRealTimers();
});

describe("POST /api/auth/session", () => {
	test("requires the setup first", async ({ aegis }) => {
		const response = await aegis.client().post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });

		expect(response.statusCode).toBe(409);
		expect(response.json().error.code).toBe("setup_required");
	});

	test("signs an admin in with an HttpOnly session cookie", async ({ aegis }) => {
		await aegis.setup();
		const browser = aegis.client();

		const response = await browser.post("/api/auth/session", { email: ` ${ADMIN.email.toUpperCase()} `, password: ADMIN.password });

		expect(response.statusCode).toBe(201);
		expect(response.json()).toMatchObject({
			type: "signed_in",
			account: { email: ADMIN.email, role: "admin" },
			instanceName: "Aegis Test",
			permissions: expect.arrayContaining(["console:access", "users:manage"]),
		});
		const cookie = response.cookies.find((entry) => entry.name === "aegis_session");
		expect(cookie).toMatchObject({ path: "/", httpOnly: true, sameSite: "Lax" });
		expect(cookie?.secure).toBeFalsy();
		expect(cookie?.value).toMatch(/^[\w-]{43}$/);

		const [event] = await auditEvents(aegis, "auth.sign_in.succeeded");
		expect(event).toMatchObject({ source: "admin", metadata: { context: "admin", secondFactor: null } });
	});

	test("answers the same for an unknown address and a wrong password", async ({ aegis }) => {
		await aegis.setup();

		const unknown = await aegis.client().post("/api/auth/session", { email: "nobody@aegis.test", password: ADMIN.password });
		const wrong = await aegis.client().post("/api/auth/session", { email: ADMIN.email, password: "wrong password" });

		expect(unknown.statusCode).toBe(401);
		expect(wrong.statusCode).toBe(401);
		expect(unknown.json()).toEqual(wrong.json());
		expect(unknown.json()).toEqual({ error: { code: "sign_in_failed", message: "Sign-in failed" } });
		expect(unknown.cookies).toEqual([]);

		const reasons = (await auditEvents(aegis, "auth.sign_in.failed")).map((event) => event.metadata.reason).sort();
		expect(reasons).toEqual(["invalid_password", "unknown_email"]);
	});

	test("refuses disabled accounts and accounts without access to the administration", async ({ aegis }) => {
		await aegis.setup();
		const disabled = await aegis.createUser({ role: "admin", enabled: false });
		const user = await aegis.createUser({ role: "user" });

		const disabledResponse = await aegis.client().post("/api/auth/session", { email: disabled.email, password: USER_PASSWORD });
		const userResponse = await aegis.client().post("/api/auth/session", { email: user.email, password: USER_PASSWORD });

		expect(disabledResponse.json().error.code).toBe("sign_in_failed");
		expect(userResponse.statusCode).toBe(403);
		expect(userResponse.json().error.code).toBe("forbidden");
		const reasons = (await auditEvents(aegis, "auth.sign_in.failed")).map((event) => event.metadata.reason).sort();
		expect(reasons).toEqual(["account_disabled", "not_permitted"]);
	});

	test("throttles an address after repeated failures, even with the right password", async ({ aegis }) => {
		await aegis.setup();
		const browser = aegis.client();
		for (let attempt = 0; attempt < 10; attempt += 1) {
			aegis.services.throttle.registerFailure(browser.ip);
		}

		const response = await browser.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });

		expect(response.statusCode).toBe(429);
		expect(response.json().error.code).toBe("sign_in_throttled");
		const [event] = await auditEvents(aegis, "auth.sign_in.failed");
		expect(event).toMatchObject({ severity: "error", metadata: { reason: "throttled" } });
		expect((await aegis.client().post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password })).statusCode).toBe(201);
	});

	test("limits the request rate per address", async ({ aegis }) => {
		await aegis.setup();
		const browser = aegis.client();
		const statuses: number[] = [];
		for (let attempt = 0; attempt < 11; attempt += 1) {
			statuses.push((await browser.post("/api/auth/session", { email: "x@aegis.test", password: "x" })).statusCode);
		}

		expect(statuses.slice(0, 10).every((status) => status === 401)).toBe(true);
		const limited = await browser.post("/api/auth/session", { email: "x@aegis.test", password: "x" });
		expect(limited.statusCode).toBe(429);
		expect(limited.json().error.code).toBe("rate_limited");
	});

	test("rehashes a password stored with outdated parameters", async ({ aegis }) => {
		await aegis.setup();
		const legacy = await new PasswordHasher({ memoryKiB: 19_456, iterations: 2, parallelism: 1 }).hash(USER_PASSWORD);
		const admin = await aegis.createUser({ role: "admin" });
		await aegis.services.users.update(admin.id, { passwordHash: legacy }, new Date());

		expect((await aegis.client().post("/api/auth/session", { email: admin.email, password: USER_PASSWORD })).statusCode).toBe(201);

		const stored = await aegis.services.users.findById(admin.id);
		expect(stored?.passwordHash).not.toBe(legacy);
		expect(aegis.services.passwords.needsRehash(stored?.passwordHash ?? "")).toBe(false);
		expect((await aegis.client().post("/api/auth/session", { email: admin.email, password: USER_PASSWORD })).statusCode).toBe(201);
	});

	test("replaces the session a browser brought along", async ({ aegis }) => {
		const browser = await aegis.setup();
		const before = browser.cookie("aegis_session");

		await browser.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });

		expect(browser.cookie("aegis_session")).not.toBe(before);
		expect(await aegis.services.auth.resolveSession(before)).toBeNull();
	});

	test("rejects malformed input", async ({ aegis }) => {
		await aegis.setup();

		const response = await aegis.client().post("/api/auth/session", { email: "", password: "" });

		expect(response.statusCode).toBe(400);
		expect(response.json().error.issues).toEqual([
			{ path: "email", code: "required" },
			{ path: "password", code: "required" },
		]);
	});
});

describe("GET /api/auth/session", () => {
	test("describes the signed-in account and requires a session", async ({ aegis }) => {
		const admin = await aegis.setup();

		expect((await aegis.client().get("/api/auth/session")).statusCode).toBe(401);
		const response = await admin.get("/api/auth/session");
		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({ account: { email: ADMIN.email }, session: { id: expect.any(String) } });
	});

	test("ignores sessions that expired, belong to disabled accounts or carry junk tokens", async ({ aegis }) => {
		const admin = await aegis.setup();
		const token = admin.cookie("aegis_session") ?? "";
		const found = await aegis.services.sessions.findActiveByTokenHash(sha256(token), new Date());
		if (!found) {
			throw new Error("expected a session");
		}

		const junk = aegis.client();
		junk.setCookie("aegis_session", "x".repeat(300));
		expect((await junk.get("/api/auth/session")).statusCode).toBe(401);

		await aegis.services.users.update(found.user.id, { enabled: false }, new Date());
		expect((await admin.get("/api/auth/session")).statusCode).toBe(401);
		await aegis.services.users.update(found.user.id, { enabled: true }, new Date());
		expect((await admin.get("/api/auth/session")).statusCode).toBe(200);

		vi.useFakeTimers({ toFake: ["Date"], now: found.session.expiresAt.getTime() + 1 });
		expect((await admin.get("/api/auth/session")).statusCode).toBe(401);
	});

	test("remembers when a session was last used, at most once a minute", async ({ aegis }) => {
		const admin = await aegis.setup();
		const token = admin.cookie("aegis_session") ?? "";
		const initial = await aegis.services.sessions.findActiveByTokenHash(sha256(token), new Date());

		await admin.get("/api/auth/session");
		const unchanged = await aegis.services.sessions.findById(initial?.session.id ?? "");
		expect(unchanged?.lastSeenAt).toEqual(initial?.session.lastSeenAt);

		vi.useFakeTimers({ toFake: ["Date"], now: Date.now() + 2 * 60_000 });
		await admin.get("/api/auth/session");
		const touched = await aegis.services.sessions.findById(initial?.session.id ?? "");
		expect(touched?.lastSeenAt.getTime()).toBeGreaterThan(initial?.session.lastSeenAt.getTime() ?? 0);
	});
});

describe("DELETE /api/auth/session", () => {
	test("ends the session and clears the cookie", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.delete("/api/auth/session");

		expect(response.statusCode).toBe(204);
		expect(admin.cookie("aegis_session")).toBeUndefined();
		expect((await admin.get("/api/auth/session")).statusCode).toBe(401);
		const [event] = await auditEvents(aegis, "auth.sign_out");
		expect(event).toMatchObject({ source: "admin", metadata: { role: "admin" } });
	});

	test("succeeds without a session", async ({ aegis }) => {
		expect((await aegis.client().delete("/api/auth/session")).statusCode).toBe(204);
	});
});

describe("second factor", () => {
	test("asks for a code after the password and signs in once it is confirmed", async ({ aegis }) => {
		const { secret } = await enableTwoFactor(await aegis.setup());
		const browser = aegis.client();

		const password = await browser.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });

		expect(password.statusCode).toBe(202);
		expect(password.json()).toMatchObject({
			type: "second_factor",
			methods: ["totp", "recovery_code"],
			account: { email: ADMIN.email },
		});
		expect(browser.cookie("aegis_session")).toBeUndefined();
		expect(browser.cookie("aegis_second_factor")).toBeDefined();

		const code = await browser.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) });

		expect(code.statusCode).toBe(201);
		expect(code.json()).toMatchObject({ type: "signed_in", account: { twoFactorEnabled: true } });
		expect(browser.cookie("aegis_second_factor")).toBeUndefined();
		const [event] = await auditEvents(aegis, "auth.sign_in.succeeded");
		expect(event?.metadata).toMatchObject({ secondFactor: "totp" });
	});

	test("accepts every authenticator code only once", async ({ aegis }) => {
		const { secret } = await enableTwoFactor(await aegis.setup());
		const first = aegis.client();
		await first.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });
		expect((await first.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) })).statusCode).toBe(201);

		const second = aegis.client();
		await second.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });
		const replayed = await second.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) });

		expect(replayed.statusCode).toBe(401);
		expect(replayed.json().error.code).toBe("second_factor_invalid");
	});

	test("accepts a recovery code once, and escalates the audit event", async ({ aegis }) => {
		const { codes } = await enableTwoFactor(await aegis.setup());
		const recovery = (codes[0] ?? "").toLowerCase().replace("-", " ");

		const first = aegis.client();
		await first.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });
		expect((await first.post("/api/auth/session/second-factor", { code: recovery })).statusCode).toBe(201);

		const second = aegis.client();
		await second.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });
		expect((await second.post("/api/auth/session/second-factor", { code: recovery })).json().error.code).toBe("second_factor_invalid");

		const [succeeded] = await auditEvents(aegis, "auth.sign_in.succeeded");
		expect(succeeded).toMatchObject({ severity: "notice", metadata: { secondFactor: "recovery_code" } });
	});

	test("starts over after five wrong codes", async ({ aegis }) => {
		const { secret } = await enableTwoFactor(await aegis.setup());
		const browser = aegis.client();
		await browser.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });

		const codes: string[] = [];
		for (let attempt = 0; attempt < 5; attempt += 1) {
			codes.push((await browser.post("/api/auth/session/second-factor", { code: "000000" })).json().error.code);
		}

		expect(codes).toEqual([
			"second_factor_invalid",
			"second_factor_invalid",
			"second_factor_invalid",
			"second_factor_invalid",
			"second_factor_expired",
		]);
		expect(browser.cookie("aegis_second_factor")).toBeUndefined();
		const valid = await browser.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) });
		expect(valid.json().error.code).toBe("second_factor_expired");
	});

	test("cannot be answered without a pending sign-in or with a copied, spent challenge", async ({ aegis }) => {
		const { secret } = await enableTwoFactor(await aegis.setup());

		expect((await aegis.client().post("/api/auth/session/second-factor", { code: "123456" })).json().error.code).toBe(
			"second_factor_expired",
		);

		const browser = aegis.client();
		await browser.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });
		const challenge = browser.cookie("aegis_second_factor") ?? "";
		await browser.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) });

		const thief = aegis.client();
		thief.setCookie("aegis_second_factor", challenge);
		expect((await thief.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) })).json().error.code).toBe(
			"second_factor_expired",
		);
	});

	test("rechecks the account and counts wrong codes towards the throttle", async ({ aegis }) => {
		const admin = await aegis.setup();
		const { secret } = await enableTwoFactor(admin);
		const me = (await admin.get("/api/auth/session")).json().account.id as string;
		const browser = aegis.client();
		await browser.post("/api/auth/session", { email: ADMIN.email, password: ADMIN.password });

		await aegis.services.users.update(me, { enabled: false }, new Date());
		expect((await browser.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) })).json().error.code).toBe(
			"sign_in_failed",
		);
		await aegis.services.users.update(me, { enabled: true }, new Date());

		for (let attempt = 0; attempt < 10; attempt += 1) {
			aegis.services.throttle.registerFailure(browser.ip);
		}
		expect((await browser.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) })).json().error.code).toBe(
			"sign_in_throttled",
		);
	});

	test("rejects a challenge for an account that lost its access meanwhile", async ({ aegis }) => {
		await aegis.setup();
		const other = await aegis.createUser({ role: "admin" });
		const otherAdmin = await aegis.signIn(other.email, USER_PASSWORD);
		const { secret } = await enableTwoFactor(otherAdmin, USER_PASSWORD);
		const browser = aegis.client();
		await browser.post("/api/auth/session", { email: other.email, password: USER_PASSWORD });

		await aegis.services.users.update(other.id, { role: "user" }, new Date());
		const response = await browser.post("/api/auth/session/second-factor", { code: totpCode(secret, 1) });

		expect(response.statusCode).toBe(403);
		expect(response.json().error.code).toBe("forbidden");
	});
});
