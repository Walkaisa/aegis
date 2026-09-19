import argon2 from "argon2";
import { randomToken } from "./tokens.js";

export interface Argon2Settings {
	memoryKiB: number;
	iterations: number;
	parallelism: number;
}

/**
 * Argon2id password hashing.
 *
 * Passwords are hashed exactly as received (UTF-8 encoded, no trimming, no normalization).
 */
export class PasswordHasher {
	public readonly settings: Argon2Settings;
	private dummyHash: Promise<string> | undefined;

	public constructor(settings: Argon2Settings) {
		this.settings = settings;
	}

	public hash(password: string): Promise<string> {
		return argon2.hash(password, {
			type: argon2.argon2id,
			memoryCost: this.settings.memoryKiB,
			timeCost: this.settings.iterations,
			parallelism: this.settings.parallelism,
		});
	}

	public async verify(hash: string, password: string): Promise<boolean> {
		try {
			return await argon2.verify(hash, password);
		} catch {
			return false;
		}
	}

	public needsRehash(hash: string): boolean {
		try {
			return argon2.needsRehash(hash, {
				memoryCost: this.settings.memoryKiB,
				timeCost: this.settings.iterations,
				parallelism: this.settings.parallelism,
			});
		} catch {
			return true;
		}
	}

	/**
	 * Performs a verification against a throwaway hash so that logins for unknown
	 * accounts take as long as logins for existing ones.
	 */
	public async verifyDummy(password: string): Promise<void> {
		this.dummyHash ??= this.hash(randomToken());
		await this.verify(await this.dummyHash, password);
	}
}
