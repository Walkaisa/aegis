import { describe, expect, it } from "vitest";
import { DAY_MS } from "../../src/lib/time.js";
import { DEFAULT_SESSION_TTL_SECONDS, getSessionPolicy } from "../../src/services/session-policy.js";

describe("session policy", () => {
	it("gives every role the lifetime of the instance settings", () => {
		expect(DEFAULT_SESSION_TTL_SECONDS * 1000).toBe(30 * DAY_MS);
		expect(getSessionPolicy("admin", 3600)).toEqual({ ttlMs: 3_600_000 });
		expect(getSessionPolicy("user", 60)).toEqual({ ttlMs: 60_000 });
	});
});
