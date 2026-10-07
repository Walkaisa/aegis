import { describe, expect, it } from "vitest";
import { MINUTE_MS } from "../../src/lib/time.js";
import { SignInThrottle } from "../../src/services/sign-in-throttle.js";

describe("SignInThrottle", () => {
	it("blocks a key after too many failures within the window", () => {
		const throttle = new SignInThrottle(3, MINUTE_MS);
		const now = 1_000_000;

		throttle.registerFailure("10.0.0.1", now);
		throttle.registerFailure("10.0.0.1", now + 1);
		expect(throttle.isBlocked("10.0.0.1", now + 2)).toBe(false);
		throttle.registerFailure("10.0.0.1", now + 2);

		expect(throttle.isBlocked("10.0.0.1", now + 3)).toBe(true);
		expect(throttle.isBlocked("10.0.0.2", now + 3)).toBe(false);
		expect(throttle.isBlocked("10.0.0.1", now + MINUTE_MS + 3)).toBe(false);
	});

	it("forgets failures after a successful sign-in and when they expire", () => {
		const throttle = new SignInThrottle(1, MINUTE_MS);
		throttle.registerFailure("a");
		expect(throttle.isBlocked("a")).toBe(true);
		throttle.reset("a");
		expect(throttle.isBlocked("a")).toBe(false);

		throttle.registerFailure("b", 0);
		throttle.sweep(MINUTE_MS + 1);
		expect(throttle.isBlocked("b", 1)).toBe(false);
	});

	it("sweeps expired keys before tracking too many", () => {
		const throttle = new SignInThrottle();
		for (let index = 0; index < 10_000; index += 1) {
			throttle.registerFailure(`old-${index}`, 0);
		}
		throttle.registerFailure("new", 16 * MINUTE_MS);
		expect(throttle.isBlocked("new", 16 * MINUTE_MS)).toBe(false);
		expect(throttle.isBlocked("old-1", 16 * MINUTE_MS)).toBe(false);
	});
});
