import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DecryptionError, Encryptor, parseEncryptionKey } from "../../src/crypto/encryption.js";

describe("parseEncryptionKey", () => {
	const key = randomBytes(32);

	it("accepts 32 bytes as base64, base64url or hex", () => {
		expect(parseEncryptionKey(key.toString("base64")).equals(key)).toBe(true);
		expect(parseEncryptionKey(` ${key.toString("base64url")} `).equals(key)).toBe(true);
		expect(parseEncryptionKey(key.toString("hex").toUpperCase()).equals(key)).toBe(true);
	});

	it("rejects anything else", () => {
		for (const raw of ["", "abc", randomBytes(16).toString("base64"), randomBytes(33).toString("hex"), `${"!".repeat(43)}=`]) {
			expect(() => parseEncryptionKey(raw)).toThrow(/exactly 32 bytes/);
		}
	});
});

describe("Encryptor", () => {
	const encryptor = new Encryptor(randomBytes(32));

	it("round-trips strings and buffers with a fresh IV each time", () => {
		const first = encryptor.encrypt("client secret", "clients.secret:1");
		const second = encryptor.encrypt("client secret", "clients.secret:1");

		expect(first).toMatch(/^v1\.[\w-]+\.[\w-]+\.[\w-]+$/);
		expect(first).not.toBe(second);
		expect(encryptor.decryptString(first, "clients.secret:1")).toBe("client secret");
		expect(encryptor.decrypt(encryptor.encrypt(Buffer.from([1, 2, 3]), "x"), "x")).toEqual(Buffer.from([1, 2, 3]));
	});

	it("binds a ciphertext to its context", () => {
		const ciphertext = encryptor.encrypt("secret", "users.totp_secret:1");
		expect(() => encryptor.decrypt(ciphertext, "users.totp_secret:2")).toThrow(DecryptionError);
	});

	it("rejects ciphertexts from another key or that were tampered with", () => {
		const ciphertext = encryptor.encrypt("secret", "ctx");
		expect(() => new Encryptor(randomBytes(32)).decrypt(ciphertext, "ctx")).toThrow("Decryption failed");

		const [version, iv, tag, data] = ciphertext.split(".") as [string, string, string, string];
		const flipped = Buffer.from(data, "base64url");
		flipped[0] = (flipped[0] ?? 0) ^ 1;
		expect(() => encryptor.decrypt([version, iv, tag, flipped.toString("base64url")].join("."), "ctx")).toThrow(DecryptionError);
	});

	it("rejects malformed payloads", () => {
		const [, iv, tag, data] = encryptor.encrypt("secret", "ctx").split(".") as [string, string, string, string];
		for (const payload of [`v2.${iv}.${tag}.${data}`, `v1.${iv}.${tag}`, `v1.${iv}.${tag}.${data}.extra`, "garbage"]) {
			expect(() => encryptor.decrypt(payload, "ctx")).toThrow("Unsupported ciphertext format");
		}
		expect(() => encryptor.decrypt(`v1.AAAA.${tag}.${data}`, "ctx")).toThrow("Malformed ciphertext");
		expect(() => encryptor.decrypt(`v1.${iv}.AAAA.${data}`, "ctx")).toThrow("Malformed ciphertext");
	});

	it("requires a 32-byte key", () => {
		expect(() => new Encryptor(randomBytes(16))).toThrow("Encryption key must be 32 bytes");
	});
});
