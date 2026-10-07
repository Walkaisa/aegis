import { TOTP_PERIOD_SECONDS } from "@aegis/contracts";
import { Secret, TOTP } from "otpauth";
import { expect } from "vitest";
import { ADMIN } from "./aegis.js";
import type { TestClient } from "./client.js";

/** The authenticator code of `secret`, `steps` time steps (30 s) from now. */
export function totpCode(secret: string, steps = 0): string {
	return new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: TOTP_PERIOD_SECONDS, algorithm: "SHA1" }).generate({
		timestamp: Date.now() + steps * TOTP_PERIOD_SECONDS * 1000,
	});
}

/**
 * Turns on two-factor authentication for the signed-in account of `browser` with the code of the
 * current time step. Returns the secret and the recovery codes.
 */
export async function enableTwoFactor(browser: TestClient, password = ADMIN.password): Promise<{ secret: string; codes: string[] }> {
	const setup = await browser.post("/api/account/two-factor/setup", { currentPassword: password });
	expect(setup.statusCode).toBe(200);
	const { secret } = setup.json() as { secret: string };

	const enabled = await browser.post("/api/account/two-factor", { code: totpCode(secret), label: "Phone" });
	expect(enabled.statusCode).toBe(200);
	return { secret, codes: (enabled.json() as { codes: string[] }).codes };
}
