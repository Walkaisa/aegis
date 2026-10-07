import { randomBytes } from "node:crypto";
import { SECOND_FACTOR_TTL_SECONDS } from "@aegis/contracts";
import { describe, expect, it } from "vitest";
import { Encryptor } from "../../src/crypto/encryption.js";
import { SecondFactorChallenges } from "../../src/services/second-factor-challenges.js";

describe("SecondFactorChallenges", () => {
	const encryptor = new Encryptor(randomBytes(32));
	const now = Date.UTC(2026, 0, 1);

	it("opens an intact challenge for its own target only", () => {
		const challenges = new SecondFactorChallenges(encryptor);
		const { token, expiresAt } = challenges.create("42", "oidc:abc", now);

		expect(expiresAt.getTime()).toBe(now + SECOND_FACTOR_TTL_SECONDS * 1000);
		expect(challenges.open(token, "oidc:abc", now)).toMatchObject({ userId: "42", expiresAt });
		expect(challenges.open(token, "admin", now)).toBeNull();
		expect(challenges.open(token, "oidc:abc", expiresAt.getTime())).toBeNull();
		expect(challenges.open(token, "oidc:abc")).toBeNull();
	});

	it("rejects missing, oversized, forged and foreign cookies", () => {
		const challenges = new SecondFactorChallenges(encryptor);
		const { token } = challenges.create("42", "admin", now);

		expect(challenges.open(undefined, "admin", now)).toBeNull();
		expect(challenges.open("x".repeat(1025), "admin", now)).toBeNull();
		expect(challenges.open("v1.forged", "admin", now)).toBeNull();
		expect(new SecondFactorChallenges(new Encryptor(randomBytes(32))).open(token, "admin", now)).toBeNull();
		const notJson = encryptor.encrypt("not json", "sign-in.second-factor-challenge");
		expect(challenges.open(notJson, "admin", now)).toBeNull();
		const noExpiry = encryptor.encrypt(JSON.stringify({ id: "x", userId: "42", target: "admin" }), "sign-in.second-factor-challenge");
		expect(challenges.open(noExpiry, "admin", now)).toBeNull();
	});

	it("is spent after five wrong codes or once it was used", () => {
		const challenges = new SecondFactorChallenges(encryptor);
		const { token } = challenges.create("42", "admin", now);
		const challenge = challenges.open(token, "admin", now);
		if (!challenge) {
			throw new Error("expected an open challenge");
		}

		expect([1, 2, 3, 4].map(() => challenges.registerFailure(challenge, now))).toEqual([false, false, false, false]);
		expect(challenges.open(token, "admin", now)).not.toBeNull();
		expect(challenges.registerFailure(challenge, now)).toBe(true);
		expect(challenges.open(token, "admin", now)).toBeNull();

		const second = challenges.create("42", "admin", now);
		const open = challenges.open(second.token, "admin", now);
		if (!open) {
			throw new Error("expected an open challenge");
		}
		challenges.consume(open, now);
		expect(challenges.open(second.token, "admin", now)).toBeNull();
	});

	it("drops expired bookkeeping before tracking too many challenges", () => {
		const challenges = new SecondFactorChallenges(encryptor);
		const used = challenges.create("42", "admin", now);
		const spent = challenges.open(used.token, "admin", now);
		if (!spent) {
			throw new Error("expected an open challenge");
		}
		challenges.consume(spent, now);
		for (let index = 1; index < 10_000; index += 1) {
			challenges.consume({ id: `old-${index}`, userId: "1", expiresAt: new Date(now) }, now);
		}
		const { token } = challenges.create("42", "admin", now + 1);
		const open = challenges.open(token, "admin", now + 1);
		if (!open) {
			throw new Error("expected an open challenge");
		}
		expect(challenges.registerFailure(open, now + 1)).toBe(false);
		// A spent challenge that has not expired yet stays spent.
		expect(challenges.open(used.token, "admin", now + 1)).toBeNull();
	});
});
