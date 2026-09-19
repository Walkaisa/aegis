import { customType } from "drizzle-orm/pg-core";

/**
 * A snowflake ID: stored as `bigint`, handled as decimal string in TypeScript because it exceeds
 * `Number.MAX_SAFE_INTEGER`. The server generates it; see `SNOWFLAKE_EPOCH` in `@aegis/contracts`.
 */
export const snowflake = customType<{ data: string; driverData: string }>({
	dataType: () => "bigint",
	fromDriver: (value) => String(value),
});

export const bytea = customType<{ data: Buffer; driverData: Buffer }>({
	dataType: () => "bytea",
});
