import { createPool } from "@aegis/db";
import type { FastifyBaseLogger } from "fastify";
import { test as base, describe, expect, vi } from "vitest";
import { affectedRows, Database, insertedRow, openDatabase } from "../../src/db/database.js";
import { createTestDatabase, type TestDatabase } from "../support/database.js";

const test = base.extend<{ database: TestDatabase }>({
	// biome-ignore lint/correctness/noEmptyPattern: Vitest reads the fixtures a fixture depends on from this pattern.
	database: async ({}, use) => {
		const database = await createTestDatabase();
		await use(database);
		await database.drop();
	},
});

function logger() {
	const log = { warn: vi.fn(), error: vi.fn() };
	return { log, logger: log as unknown as FastifyBaseLogger };
}

describe("openDatabase", () => {
	test("waits for PostgreSQL to accept connections", async ({ database }) => {
		const { log, logger: fastifyLog } = logger();
		vi.spyOn(Database.prototype, "ping").mockRejectedValueOnce(new Error("ECONNREFUSED"));

		const opened = await openDatabase(database.url, fastifyLog);
		await opened.close();

		expect(log.warn).toHaveBeenCalledWith(
			{ attempt: 1, err: expect.objectContaining({ message: "ECONNREFUSED" }) },
			"Waiting for PostgreSQL",
		);
	});

	test("gives up after a minute", async ({ database }) => {
		const { logger: fastifyLog } = logger();
		const close = vi.spyOn(Database.prototype, "close");
		vi.spyOn(Database.prototype, "ping").mockRejectedValue(new Error("ECONNREFUSED"));
		const now = Date.now();
		vi.spyOn(Date, "now")
			.mockReturnValueOnce(now)
			.mockReturnValue(now + 60_000);

		await expect(openDatabase(database.url, fastifyLog)).rejects.toThrow("ECONNREFUSED");
		expect(close).toHaveBeenCalledOnce();
	});

	test("closes the connection when the migrations fail", async ({ database }) => {
		const { logger: fastifyLog } = logger();
		const close = vi.spyOn(Database.prototype, "close");
		vi.spyOn(Database.prototype, "migrate").mockRejectedValueOnce(new Error("migration failed"));

		await expect(openDatabase(database.url, fastifyLog)).rejects.toThrow("migration failed");
		expect(close).toHaveBeenCalledOnce();
	});

	test("logs connections that PostgreSQL drops", async ({ database }) => {
		const { log, logger: fastifyLog } = logger();
		const opened = await openDatabase(database.url, fastifyLog);
		const admin = createPool(database.url);
		try {
			await admin.query(
				"SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()",
			);
			await vi.waitFor(() => expect(log.error).toHaveBeenCalledWith({ err: expect.any(Error) }, "PostgreSQL connection error"));
		} finally {
			await admin.end();
			await opened.close();
		}
	});
});

describe("Database", () => {
	test("runs nested transactions as part of the outer one", async ({ database }) => {
		const db = new Database(database.url, logger().logger);
		try {
			await expect(
				db.transaction(async () => {
					await db.transaction(async () => {
						await db.db.execute("CREATE TABLE nested (id int)");
					});
					throw new Error("roll back");
				}),
			).rejects.toThrow("roll back");

			const { rows } = await db.db.execute("SELECT to_regclass('nested') AS name");
			expect(rows).toEqual([{ name: null }]);
		} finally {
			await db.close();
		}
	});
});

describe("affectedRows", () => {
	test("counts no rows for commands that report none", () => {
		expect(affectedRows({ rowCount: 3 })).toBe(3);
		expect(affectedRows({ rowCount: null })).toBe(0);
	});
});

describe("insertedRow", () => {
	test("fails loudly when an insert returned nothing", () => {
		expect(insertedRow([{ id: 1 }])).toEqual({ id: 1 });
		expect(() => insertedRow([])).toThrow("The insert returned no row");
	});
});
