import { RECOVERY_CODE_COUNT, TOTP_PERIOD_SECONDS } from "@aegis/contracts";
import { Secret, TOTP } from "otpauth";
import { describe, expect, it } from "vitest";
import {
	generateRecoveryCodes,
	generateTotpSecret,
	hashRecoveryCode,
	isTotpCode,
	matchTotp,
	totpUri,
} from "../../src/crypto/one-time-codes.js";

describe("one-time codes", () => {
	const secret = generateTotpSecret();
	const totp = new TOTP({ secret: Secret.fromBase32(secret), digits: 6, period: TOTP_PERIOD_SECONDS, algorithm: "SHA1" });

	it("creates 160-bit secrets and otpauth URIs", () => {
		expect(Secret.fromBase32(secret).bytes).toHaveLength(20);
		const uri = new URL(totpUri(secret, "Acme Login", "ada@acme.test"));
		expect(uri.protocol).toBe("otpauth:");
		expect(uri.searchParams.get("issuer")).toBe("Acme Login");
		expect(uri.searchParams.get("secret")).toBe(secret);
		expect(decodeURIComponent(uri.pathname)).toContain("ada@acme.test");
	});

	it("tells authenticator codes from recovery codes", () => {
		expect(isTotpCode("123456")).toBe(true);
		expect(isTotpCode("123 456")).toBe(true);
		expect(isTotpCode("12345")).toBe(false);
		expect(isTotpCode("K7PQM-3XHVT")).toBe(false);
	});

	it("accepts the current code and its neighbours, returning the time step", () => {
		const now = Date.UTC(2026, 0, 1, 12);
		const step = Math.floor(now / 1000 / TOTP_PERIOD_SECONDS);
		const at = (offset: number) => totp.generate({ timestamp: now + offset * TOTP_PERIOD_SECONDS * 1000 });

		expect(matchTotp(secret, at(0), now)).toBe(step);
		expect(matchTotp(secret, at(-1), now)).toBe(step - 1);
		expect(matchTotp(secret, ` ${at(1).slice(0, 3)} ${at(1).slice(3)} `, now)).toBe(step + 1);
		expect(matchTotp(secret, at(3), now)).toBeNull();
		expect(matchTotp(secret, totp.generate())).toBeTypeOf("number");
	});

	it("generates distinct, readable recovery codes", () => {
		const codes = generateRecoveryCodes();
		expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
		expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
		for (const code of codes) {
			expect(code).toMatch(/^[A-HJKMNP-Z2-9]{5}-[A-HJKMNP-Z2-9]{5}$/);
		}
		expect(generateRecoveryCodes(3)).toHaveLength(3);
	});

	it("hashes recovery codes independent of case and separators", () => {
		expect(hashRecoveryCode("k7pqm 3xhvt")).toBe(hashRecoveryCode("K7PQM-3XHVT"));
		expect(hashRecoveryCode("K7PQM-3XHVT")).not.toBe(hashRecoveryCode("K7PQM-3XHVU"));
	});
});
