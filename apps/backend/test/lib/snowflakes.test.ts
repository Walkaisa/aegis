import { SNOWFLAKE_EPOCH, snowflakeDate } from "@aegis/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newId } from "../../src/lib/snowflakes.js";
import { DAY_MS } from "../../src/lib/time.js";

describe("newId", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("issues strictly increasing snowflakes that carry their creation time", () => {
		const ids = Array.from({ length: 50 }, () => newId());
		for (let index = 1; index < ids.length; index += 1) {
			expect(BigInt(ids[index] ?? "0")).toBeGreaterThan(BigInt(ids[index - 1] ?? "0"));
		}
		expect(Math.abs(snowflakeDate(ids[0] ?? "0").getTime() - Date.now())).toBeLessThan(5_000);
	});

	it("keeps counting when a millisecond runs out of increments or the clock steps back", () => {
		vi.useFakeTimers({ now: SNOWFLAKE_EPOCH + 10 * DAY_MS + 1_000_000_000_000 });
		const first = newId();
		const burst = Array.from({ length: 4097 }, () => newId());
		const last = burst.at(-1) ?? "0";
		expect(snowflakeDate(last).getTime()).toBe(snowflakeDate(first).getTime() + 1);

		vi.setSystemTime(Date.now() - 60_000);
		const afterStepBack = newId();
		expect(BigInt(afterStepBack)).toBeGreaterThan(BigInt(last));
	});
});
