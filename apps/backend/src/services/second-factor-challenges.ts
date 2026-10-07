import { SECOND_FACTOR_TTL_SECONDS } from "@aegis/contracts";
import type { Encryptor } from "../crypto/encryption.js";
import { randomToken } from "../crypto/tokens.js";
import { SECOND_MS } from "../lib/time.js";

/**
 * Where a pending sign-in continues: the administration, or the authorization request with the
 * given interaction id. A challenge can only be answered where it was started.
 */
export type ChallengeTarget = "admin" | `oidc:${string}`;

export interface OpenChallenge {
	id: string;
	userId: string;
	expiresAt: Date;
}

interface ChallengePayload {
	id: string;
	userId: string;
	target: ChallengeTarget;
	/** Expiry in epoch milliseconds. */
	exp: number;
}

const ENCRYPTION_CONTEXT = "sign-in.second-factor-challenge";
const MAX_ATTEMPTS = 5;
const MAX_TRACKED = 10_000;

/**
 * Sign-ins waiting for their second factor. The browser holds the challenge as an encrypted cookie,
 * so a correct password is never turned into a session before the code is confirmed. Wrong codes
 * and completed challenges are tracked in memory: after a few wrong codes, or once used, a
 * challenge is spent and the sign-in starts over with the password.
 */
export class SecondFactorChallenges {
	private readonly encryptor: Encryptor;
	/** Challenge id → wrong codes so far, or `Infinity` once spent; kept until the challenge expires. */
	private readonly attempts = new Map<string, { failures: number; expiresAt: number }>();

	public constructor(encryptor: Encryptor) {
		this.encryptor = encryptor;
	}

	public create(userId: string, target: ChallengeTarget, now = Date.now()): { token: string; expiresAt: Date } {
		const payload: ChallengePayload = { id: randomToken(16), userId, target, exp: now + SECOND_FACTOR_TTL_SECONDS * SECOND_MS };
		return { token: this.encryptor.encrypt(JSON.stringify(payload), ENCRYPTION_CONTEXT), expiresAt: new Date(payload.exp) };
	}

	/** The challenge behind a cookie value, if it is intact, meant for `target`, unexpired and not spent. */
	public open(token: string | undefined, target: ChallengeTarget, now = Date.now()): OpenChallenge | null {
		if (!token || token.length > 1024) {
			return null;
		}

		let payload: ChallengePayload;
		try {
			payload = JSON.parse(this.encryptor.decryptString(token, ENCRYPTION_CONTEXT)) as ChallengePayload;
		} catch {
			return null;
		}

		if (payload.target !== target || typeof payload.exp !== "number" || payload.exp <= now) {
			return null;
		}
		const tracked = this.attempts.get(payload.id);
		if (tracked && tracked.failures >= MAX_ATTEMPTS) {
			return null;
		}
		return { id: payload.id, userId: payload.userId, expiresAt: new Date(payload.exp) };
	}

	/** Counts a wrong code; returns true once the challenge is spent. */
	public registerFailure(challenge: OpenChallenge, now = Date.now()): boolean {
		const failures = (this.attempts.get(challenge.id)?.failures ?? 0) + 1;
		this.track(challenge, failures, now);
		return failures >= MAX_ATTEMPTS;
	}

	/** A completed challenge cannot be answered again, even with a copied cookie. */
	public consume(challenge: OpenChallenge, now = Date.now()): void {
		this.track(challenge, Number.POSITIVE_INFINITY, now);
	}

	private track(challenge: OpenChallenge, failures: number, now: number): void {
		if (this.attempts.size >= MAX_TRACKED) {
			for (const [id, entry] of this.attempts) {
				if (entry.expiresAt <= now) {
					this.attempts.delete(id);
				}
			}
		}
		this.attempts.set(challenge.id, { failures, expiresAt: challenge.expiresAt.getTime() });
	}
}
