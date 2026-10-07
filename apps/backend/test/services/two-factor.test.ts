import { describe, expect, vi } from "vitest";
import { test, USER_PASSWORD } from "../support/aegis.js";
import { totpCode } from "../support/two-factor.js";

describe("TwoFactorService", () => {
	test("names the instance in the authenticator, or Aegis before the setup", async ({ aegis }) => {
		const user = await aegis.createUser({ role: "admin" });

		const setup = await aegis.services.twoFactor.beginSetup(user, USER_PASSWORD);

		expect(setup.issuer).toBe("Aegis");
		expect(await aegis.services.twoFactor.verify(user, "123456")).toBeNull();
	});

	test("ends with 404 when the account is gone meanwhile", async ({ aegis }) => {
		const admin = await aegis.setup();
		const other = await aegis.createUser({ role: "admin" });
		const browser = await aegis.signIn(other.email, USER_PASSWORD);
		const { secret } = (await browser.post("/api/account/two-factor/setup", { currentPassword: USER_PASSWORD })).json();

		vi.spyOn(aegis.services.users, "update").mockResolvedValueOnce(null);
		expect((await browser.post("/api/account/two-factor", { code: totpCode(secret), label: "Phone" })).statusCode).toBe(404);

		vi.spyOn(aegis.services.users, "update").mockResolvedValueOnce(null);
		expect((await admin.delete(`/api/users/${other.id}/two-factor`)).statusCode).toBe(404);
	});
});
