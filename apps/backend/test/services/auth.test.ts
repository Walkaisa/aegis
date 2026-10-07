import { ACR_VALUES } from "@aegis/contracts";
import { describe, expect, it } from "vitest";
import { acrOf, authenticationMethodsOf } from "../../src/services/auth.js";
import { DEFAULT_SESSION_TTL_SECONDS } from "../../src/services/session-policy.js";
import { ADMIN, NO_ORIGIN, test, USER_PASSWORD } from "../support/aegis.js";
import { auditEvents } from "../support/audit.js";

describe("AuthService without a client address", () => {
	test("throttles and records sign-ins under one shared key", async ({ aegis }) => {
		await aegis.setup();
		const { auth, throttle } = aegis.services;
		const target = { context: "admin" } as const;

		await expect(auth.verifyPassword(ADMIN.email, "wrong password", NO_ORIGIN, target)).rejects.toMatchObject({
			code: "sign_in_failed",
		});
		const admin = await auth.verifyPassword(ADMIN.email, ADMIN.password, NO_ORIGIN, target);
		await auth.completeSignIn(admin, null, NO_ORIGIN, target);
		expect(throttle.isBlocked("unknown")).toBe(false);

		for (let attempt = 0; attempt < 20; attempt += 1) {
			throttle.registerFailure("unknown");
		}
		await expect(auth.verifySecondFactor("1", "123456", NO_ORIGIN, target)).rejects.toMatchObject({ code: "sign_in_throttled" });
		const [throttled] = await auditEvents(aegis, "auth.sign_in.failed");
		expect(throttled?.metadata).toMatchObject({ reason: "throttled", email: "" });
	});

	test("does not count sign-ins of disabled accounts as guessing", async ({ aegis }) => {
		await aegis.setup();
		const user = await aegis.createUser({ enabled: false });

		await expect(aegis.services.auth.verifyPassword(user.email, USER_PASSWORD, NO_ORIGIN, { context: "admin" })).rejects.toThrow();

		const [failed] = await auditEvents(aegis, "auth.sign_in.failed");
		expect(failed?.metadata.reason).toBe("account_disabled");
	});
});

describe("AuthService sessions", () => {
	test("last as long as the default before the setup", async ({ aegis }) => {
		const user = await aegis.createUser({ role: "admin" });

		const { session } = await aegis.services.auth.createSession(user, NO_ORIGIN);

		const lifetime = session.expiresAt.getTime() - session.createdAt.getTime();
		expect(lifetime).toBe(DEFAULT_SESSION_TTL_SECONDS * 1000);
	});

	test("of users end as a user's sign-out", async ({ aegis }) => {
		await aegis.setup();
		const browser = await aegis.sessionFor(await aegis.createUser());

		expect((await browser.delete("/api/auth/session")).statusCode).toBe(204);

		const [signedOut] = await auditEvents(aegis, "auth.sign_out");
		expect(signedOut).toMatchObject({ source: "user", metadata: { role: "user" } });
	});
});

describe("authentication methods", () => {
	it("follows RFC 8176 and derives the acr from them", () => {
		expect(authenticationMethodsOf(null)).toEqual(["pwd"]);
		expect(authenticationMethodsOf("totp")).toEqual(["pwd", "otp", "mfa"]);
		expect(authenticationMethodsOf("recovery_code")).toEqual(["pwd", "mfa"]);
		expect(acrOf(["pwd"])).toBe(ACR_VALUES.password);
		expect(acrOf(["pwd", "mfa"])).toBe(ACR_VALUES.mfa);
	});
});
