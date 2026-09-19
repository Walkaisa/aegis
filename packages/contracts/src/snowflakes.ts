import { z } from "zod";

/**
 * Every entity in Aegis is identified by a snowflake, like on Discord: a 64-bit integer whose
 * upper 42 bits are milliseconds since this epoch, followed by 5 bits worker, 5 bits process and
 * 12 bits increment. Snowflakes sort by creation time and reveal when an entity was created.
 *
 * They exceed `Number.MAX_SAFE_INTEGER`, so they always travel as decimal strings.
 */
export const SNOWFLAKE_EPOCH = Date.UTC(2002, 4, 30);

/** A snowflake as decimal string. */
export type Snowflake = string;

const SNOWFLAKE_PATTERN = /^[1-9][0-9]{0,18}$/;
const MAX_SNOWFLAKE = 9223372036854775807n;
const TIMESTAMP_SHIFT = 22n;

/** Whether a value is a snowflake Aegis could have issued: a positive decimal that fits a signed 64-bit integer. */
export function isSnowflake(value: unknown): value is Snowflake {
	return typeof value === "string" && SNOWFLAKE_PATTERN.test(value) && BigInt(value) <= MAX_SNOWFLAKE;
}

/** When the entity behind a snowflake was created. */
export function snowflakeDate(id: Snowflake): Date {
	return new Date(Number(BigInt(id) >> TIMESTAMP_SHIFT) + SNOWFLAKE_EPOCH);
}

export const snowflakeSchema = z.string({ error: "invalid" }).refine(isSnowflake, { error: "invalid" });
