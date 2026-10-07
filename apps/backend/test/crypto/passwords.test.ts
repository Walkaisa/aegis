import argon2 from "argon2";
import { describe, expect, it, vi } from "vitest";
import { PasswordHasher } from "../../src/crypto/passwords.js";

describe("PasswordHasher", () => {
	const settings = { memoryKiB: 19_456, iterations: 1, parallelism: 1 };
	const hasher = new PasswordHasher(settings);

	it("hashes with Argon2id and verifies the exact password", async () => {
		const hash = await hasher.hash(" Pässword ");

		expect(hash).toMatch(/^\$argon2id\$v=19\$/);
		expect(hash.split("$")[3]?.split(",").sort()).toEqual(["m=19456", "p=1", "t=1"]);
		await expect(hasher.verify(hash, " Pässword ")).resolves.toBe(true);
		await expect(hasher.verify(hash, "Pässword")).resolves.toBe(false);
		await expect(hasher.verify("not a hash", "x")).resolves.toBe(false);
	});

	it("asks for a rehash when the parameters changed", async () => {
		const hash = await hasher.hash("password");

		expect(hasher.needsRehash(hash)).toBe(false);
		expect(new PasswordHasher({ ...settings, iterations: 2 }).needsRehash(hash)).toBe(true);
		expect(hasher.needsRehash("not a hash")).toBe(true);
	});

	it("verifies against one throwaway hash for unknown accounts", async () => {
		const verify = vi.spyOn(argon2, "verify");
		const dummy = new PasswordHasher(settings);

		await dummy.verifyDummy("guess");
		await dummy.verifyDummy("guess again");

		expect(verify).toHaveBeenCalledTimes(2);
		expect(verify.mock.calls[0]?.[0]).toBe(verify.mock.calls[1]?.[0]);
	});
});
