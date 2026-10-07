import type { CookieKeyRecord, SigningKeyRecord } from "@aegis/db";
import { calculateJwkThumbprint, exportJWK, generateKeyPair, type JWK } from "jose";
import type { Encryptor } from "../crypto/encryption.js";
import { randomToken } from "../crypto/tokens.js";
import { newId } from "../lib/snowflakes.js";
import { DAY_MS } from "../lib/time.js";
import type { KeyRepository } from "../repositories/keys.js";

export const SIGNING_ALGORITHM = "RS256";
const RSA_MODULUS_LENGTH = 3072;

/** Retired signing keys stay in the JWKS so that tokens signed shortly before a rotation still verify. */
export const RETIRED_KEY_RETENTION_DAYS = 7;

const KEY_CHECK_PLAINTEXT = "aegis-encryption-key-check";
const KEY_CHECK_CONTEXT = "system_settings:encryption_key_check";

const signingKeyContext = (kid: string) => `signing_key:${kid}`;
const cookieKeyContext = (id: string) => `cookie_key:${id}`;

/**
 * Generates, encrypts and loads the provider's key material. Private keys and cookie keys only
 * exist in plaintext in memory; at rest they are encrypted with AEGIS_ENCRYPTION_KEY.
 */
export class KeyService {
	private readonly keys: KeyRepository;
	private readonly encryptor: Encryptor;

	public constructor(keys: KeyRepository, encryptor: Encryptor) {
		this.keys = keys;
		this.encryptor = encryptor;
	}

	public async createSigningKey(at: Date): Promise<SigningKeyRecord> {
		const { privateKey } = await generateKeyPair(SIGNING_ALGORITHM, { modulusLength: RSA_MODULUS_LENGTH, extractable: true });
		const jwk = await exportJWK(privateKey);
		const kid = await calculateJwkThumbprint(jwk, "sha256");
		const privateJwk: JWK = { ...jwk, kid, alg: SIGNING_ALGORITHM, use: "sig" };

		return {
			kid,
			algorithm: SIGNING_ALGORITHM,
			privateJwkCiphertext: this.encryptor.encrypt(JSON.stringify(privateJwk), signingKeyContext(kid)),
			status: "active",
			createdAt: at,
			retiredAt: null,
		};
	}

	public createCookieKey(at: Date): CookieKeyRecord {
		const id = newId();
		return { id, keyCiphertext: this.encryptor.encrypt(randomToken(32), cookieKeyContext(id)), createdAt: at };
	}

	/** Private JWKS for oidc-provider: the active key first (used for signing), retired keys after it. */
	public async loadSigningJwks(): Promise<{ keys: JWK[] }> {
		const keys = await this.keys.listSigningKeys();
		return {
			keys: keys.map((key) => JSON.parse(this.encryptor.decryptString(key.privateJwkCiphertext, signingKeyContext(key.kid))) as JWK),
		};
	}

	public async loadCookieKeys(): Promise<string[]> {
		const keys = await this.keys.listCookieKeys();
		return keys.map((key) => this.encryptor.decryptString(key.keyCiphertext, cookieKeyContext(key.id)));
	}

	public async rotateSigningKey(at: Date): Promise<SigningKeyRecord> {
		const next = await this.createSigningKey(at);
		await this.keys.rotateSigningKey(next, at);
		return next;
	}

	public pruneRetiredKeys(now: Date): Promise<number> {
		return this.keys.deleteRetiredSigningKeysBefore(new Date(now.getTime() - RETIRED_KEY_RETENTION_DAYS * DAY_MS));
	}

	public createKeyCheck(): string {
		return this.encryptor.encrypt(KEY_CHECK_PLAINTEXT, KEY_CHECK_CONTEXT);
	}

	/** Detects a changed AEGIS_ENCRYPTION_KEY before any secret is used. */
	public verifyKeyCheck(keyCheck: string): boolean {
		try {
			return this.encryptor.decryptString(keyCheck, KEY_CHECK_CONTEXT) === KEY_CHECK_PLAINTEXT;
		} catch {
			return false;
		}
	}
}
