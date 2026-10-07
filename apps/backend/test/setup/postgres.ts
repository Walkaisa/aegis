import { createDatabase, createPool, runMigrations } from "@aegis/db";
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

export const TEMPLATE_DATABASE = "aegis_template";

declare module "vitest" {
	export interface ProvidedContext {
		/** Connection URL of the PostgreSQL server, without a database. */
		postgresUrl: string;
	}
}

let container: StartedPostgreSqlContainer | undefined;

/**
 * Starts one PostgreSQL server for the whole run and migrates a template database. Every test file
 * clones the template into a database of its own (`test/support/database.ts`), which takes milliseconds and
 * lets files run in parallel without seeing each other's rows.
 */
export async function setup(project: TestProject): Promise<void> {
	container = await new PostgreSqlContainer("postgres:18-alpine")
		.withDatabase(TEMPLATE_DATABASE)
		.withTmpFs({ "/var/lib/postgresql": "rw" })
		.withCommand(["postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"])
		.start();

	const url = new URL(container.getConnectionUri());
	const pool = createPool(url.toString());
	try {
		await runMigrations(pool, createDatabase(pool));
	} finally {
		await pool.end();
	}

	url.pathname = "/postgres";
	project.provide("postgresUrl", url.toString());
}

export async function teardown(): Promise<void> {
	await container?.stop();
}
