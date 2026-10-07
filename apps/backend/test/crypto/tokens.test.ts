import { describe, expect, it } from "vitest";
import { constantTimeEqual, randomToken, sha256 } from "../../src/crypto/tokens.js";

describe("tokens", () => {
	it("creates URL-safe random tokens", () => {
		expect(randomToken()).toMatch(/^[\w-]{43}$/);
		expect(randomToken(16)).toMatch(/^[\w-]{22}$/);
		expect(randomToken()).not.toBe(randomToken());
	});

	it("hashes and compares in constant time", () => {
		expect(sha256("abc")).toBe("ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0");
		expect(constantTimeEqual("secret", "secret")).toBe(true);
		expect(constantTimeEqual("secret", "secreT")).toBe(false);
		expect(constantTimeEqual("secret", "a much longer value")).toBe(false);
	});
});
