import { MINUTE_MS } from "../lib/time.js";

const MAX_TRACKED_KEYS = 10_000;

/**
 * Throttles failed sign-in attempts per client IP over a longer window than the per-minute
 * rate limit. Keyed by IP rather than by account, so an attacker cannot lock accounts out.
 */
export class SignInThrottle {
	private readonly failures = new Map<string, number[]>();
	private readonly maxFailures: number;
	private readonly windowMs: number;

	public constructor(maxFailures = 10, windowMs = 15 * MINUTE_MS) {
		this.maxFailures = maxFailures;
		this.windowMs = windowMs;
	}

	public isBlocked(key: string, now: number = Date.now()): boolean {
		return this.recent(key, now).length >= this.maxFailures;
	}

	public registerFailure(key: string, now: number = Date.now()): void {
		if (this.failures.size >= MAX_TRACKED_KEYS) {
			this.sweep(now);
		}
		const recent = this.recent(key, now);
		recent.push(now);
		this.failures.set(key, recent);
	}

	public reset(key: string): void {
		this.failures.delete(key);
	}

	public sweep(now: number = Date.now()): void {
		for (const key of [...this.failures.keys()]) {
			this.recent(key, now);
		}
	}

	private recent(key: string, now: number): number[] {
		const cutoff = now - this.windowMs;
		const recent = (this.failures.get(key) ?? []).filter((timestamp) => timestamp > cutoff);
		if (recent.length > 0) {
			this.failures.set(key, recent);
		} else {
			this.failures.delete(key);
		}
		return recent;
	}
}
