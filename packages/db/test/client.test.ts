import type pg from "pg";
import { describe, expect, it, vi } from "vitest";
import { type AegisDatabase, isUniqueViolation, runMigrations } from "../src/client";

describe("runMigrations", () => {
	it("returns the lock connection even when the lock cannot be released", async () => {
		const client = {
			query: vi.fn(async (statement: string) => {
				throw new Error(statement.includes("unlock") ? "connection lost" : "lock timeout");
			}),
			release: vi.fn(),
		};
		const pool = { connect: async () => client } as unknown as pg.Pool;

		await expect(runMigrations(pool, {} as AegisDatabase)).rejects.toThrow("lock timeout");
		expect(client.query).toHaveBeenCalledTimes(2);
		expect(client.release).toHaveBeenCalledOnce();
	});
});

describe("isUniqueViolation", () => {
	it("recognizes unique violations, also when Drizzle wraps them", () => {
		expect(isUniqueViolation({ code: "23505" })).toBe(true);
		expect(isUniqueViolation({ cause: { code: "23505" } })).toBe(true);
		expect(isUniqueViolation({ code: "23503" })).toBe(false);
		expect(isUniqueViolation({ cause: {} })).toBe(false);
		expect(isUniqueViolation(new Error("other"))).toBe(false);
		expect(isUniqueViolation(null)).toBe(false);
	});
});
