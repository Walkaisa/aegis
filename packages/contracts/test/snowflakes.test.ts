import { describe, expect, it } from "vitest";
import { isSnowflake, SNOWFLAKE_EPOCH, snowflakeDate, snowflakeSchema } from "../src/snowflakes";

describe("isSnowflake", () => {
	it("accepts positive 64-bit decimals only", () => {
		expect(isSnowflake("1")).toBe(true);
		expect(isSnowflake("9223372036854775807")).toBe(true);
		expect(isSnowflake("9223372036854775808")).toBe(false);
		expect(isSnowflake("0")).toBe(false);
		expect(isSnowflake("01")).toBe(false);
		expect(isSnowflake("-1")).toBe(false);
		expect(isSnowflake("1e3")).toBe(false);
		expect(isSnowflake(1)).toBe(false);
		expect(snowflakeSchema.safeParse("abc").success).toBe(false);
	});
});

describe("snowflakeDate", () => {
	it("reveals when an entity was created", () => {
		const created = Date.UTC(2026, 8, 27, 12);
		const id = ((BigInt(created - SNOWFLAKE_EPOCH) << 22n) | 7n).toString();
		expect(snowflakeDate(id).getTime()).toBe(created);
	});
});
