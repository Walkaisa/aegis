import { randomUUID } from "node:crypto";
import { createPool } from "@aegis/db";
import { inject } from "vitest";
import { TEMPLATE_DATABASE } from "../setup/postgres.js";

export interface TestDatabase {
	url: string;
	drop(): Promise<void>;
}

async function run(url: string, statement: string): Promise<void> {
	const pool = createPool(url);
	try {
		await pool.query(statement);
	} finally {
		await pool.end();
	}
}

/** A fresh, fully migrated database, cloned from the template the global setup prepared. */
export async function createTestDatabase(): Promise<TestDatabase> {
	const server = inject("postgresUrl");
	const name = `test_${randomUUID().replaceAll("-", "")}`;
	await run(server, `CREATE DATABASE "${name}" TEMPLATE "${TEMPLATE_DATABASE}"`);

	const url = new URL(server);
	url.pathname = `/${name}`;
	return {
		url: url.toString(),
		drop: () => run(server, `DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`),
	};
}

/** The error PostgreSQL reports when an insert or update collides with a unique constraint. */
export function uniqueViolation(): Error {
	return Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" });
}
