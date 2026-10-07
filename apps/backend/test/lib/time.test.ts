import { describe, expect, it } from "vitest";
import { DAY_MS, HOUR_MS, MINUTE_MS, SECOND_MS, toEpochSeconds, toIso, toIsoOrNull } from "../../src/lib/time.js";

describe("time", () => {
	it("defines the units and conversions", () => {
		expect([SECOND_MS, MINUTE_MS, HOUR_MS, DAY_MS]).toEqual([1_000, 60_000, 3_600_000, 86_400_000]);
		const date = new Date(Date.UTC(2026, 8, 27, 12, 0, 0, 999));
		expect(toIso(date)).toBe("2026-09-27T12:00:00.999Z");
		expect(toIsoOrNull(date)).toBe("2026-09-27T12:00:00.999Z");
		expect(toIsoOrNull(null)).toBeNull();
		expect(toEpochSeconds(date)).toBe(Date.UTC(2026, 8, 27, 12) / 1000);
	});
});
