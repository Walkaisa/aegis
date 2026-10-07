import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;

export class DecryptionError extends Error {
	public constructor(message = "Decryption failed") {
		super(message);
		this.name = "DecryptionError";
	}
}

/**
 * Parses AEGIS_ENCRYPTION_KEY. Accepts 32 random bytes encoded as base64, base64url or hex.
 */
export function parseEncryptionKey(raw: string): Buffer {
	const value = raw.trim();
	let key: Buffer | undefined;

	if (/^[0-9a-fA-F]{64}$/.test(value)) {
		key = Buffer.from(value, "hex");
	} else if (/^[A-Za-z0-9+/_-]{43}={0,1}$/.test(value)) {
		key = Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
	}

	if (!key || key.length !== KEY_BYTES) {
		throw new Error("AEGIS_ENCRYPTION_KEY must be exactly 32 bytes encoded as base64 or hex (e.g. `openssl rand -base64 32`)");
	}
	return key;
}

/**
 * Authenticated encryption for secrets at rest (signing keys, cookie keys, client secrets).
 *
 * Every ciphertext is bound to a context string via AES-GCM additional authenticated data,
 * so a ciphertext copied into a different row or column fails to decrypt.
 *
 * Format: `v1.<iv>.<tag>.<ciphertext>` (base64url segments).
 */
export class Encryptor {
	private readonly key: Buffer;

	public constructor(key: Buffer) {
		if (key.length !== KEY_BYTES) {
			throw new Error("Encryption key must be 32 bytes");
		}
		this.key = key;
	}

	public encrypt(plaintext: string | Buffer, context: string): string {
		const iv = randomBytes(IV_BYTES);
		const cipher = createCipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES });
		cipher.setAAD(Buffer.from(`aegis:${context}`, "utf8"));
		const ciphertext = Buffer.concat([
			cipher.update(typeof plaintext === "string" ? Buffer.from(plaintext, "utf8") : plaintext),
			cipher.final(),
		]);
		const tag = cipher.getAuthTag();
		return [FORMAT_VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
	}

	public decrypt(payload: string, context: string): Buffer {
		const [version, ivPart, tagPart, dataPart, ...rest] = payload.split(".");
		if (version !== FORMAT_VERSION || ivPart === undefined || tagPart === undefined || dataPart === undefined || rest.length > 0) {
			throw new DecryptionError("Unsupported ciphertext format");
		}

		const iv = Buffer.from(ivPart, "base64url");
		const tag = Buffer.from(tagPart, "base64url");
		if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
			throw new DecryptionError("Malformed ciphertext");
		}

		try {
			const decipher = createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: TAG_BYTES });
			decipher.setAAD(Buffer.from(`aegis:${context}`, "utf8"));
			decipher.setAuthTag(tag);
			return Buffer.concat([decipher.update(Buffer.from(dataPart, "base64url")), decipher.final()]);
		} catch {
			throw new DecryptionError();
		}
	}

	public decryptString(payload: string, context: string): string {
		return this.decrypt(payload, context).toString("utf8");
	}
}
