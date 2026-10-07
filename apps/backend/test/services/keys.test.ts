import { randomBytes } from "node:crypto";
import { describe, expect } from "vitest";
import { Encryptor } from "../../src/crypto/encryption.js";
import { KeyRepository } from "../../src/repositories/keys.js";
import { KeyService } from "../../src/services/keys.js";
import { test } from "../support/aegis.js";

describe("KeyService.verifyKeyCheck", () => {
	test("recognizes the encryption key an instance was set up with", async ({ aegis }) => {
		const check = aegis.services.keyService.createKeyCheck();
		const otherKey = new KeyService(new KeyRepository(aegis.services.database), new Encryptor(randomBytes(32)));

		expect(aegis.services.keyService.verifyKeyCheck(check)).toBe(true);
		expect(otherKey.verifyKeyCheck(check)).toBe(false);
		expect(aegis.services.keyService.verifyKeyCheck("not a ciphertext")).toBe(false);
	});
});
