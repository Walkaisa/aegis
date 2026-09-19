import { fileURLToPath } from "node:url";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import * as schema from "./schema/index";

export type AegisSchema = typeof schema;
export type AegisDatabase = NodePgDatabase<AegisSchema>;
export type AegisTransaction = Parameters<Parameters<AegisDatabase["transaction"]>[0]>[0];
/** Either the database itself or an open transaction; repositories accept both. */
export type AegisExecutor = AegisDatabase | AegisTransaction;

/** Generated SQL migrations, shipped next to the compiled package. */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL("../migrations", import.meta.url));

const MIGRATION_LOCK_ID = 7_314_159;

export function createPool(connectionString: string): pg.Pool {
	return new pg.Pool({
		connectionString,
		max: 10,
		connectionTimeoutMillis: 5_000,
		idleTimeoutMillis: 30_000,
	});
}

export function createDatabase(pool: pg.Pool): AegisDatabase {
	return drizzle({ client: pool, schema });
}

/**
 * Applies pending migrations. A session-level advisory lock serializes concurrent starts of
 * several Aegis instances against the same database.
 */
export async function runMigrations(pool: pg.Pool, database: AegisDatabase): Promise<void> {
	const lock = await pool.connect();
	try {
		await lock.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_ID]);
		await migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
	} finally {
		await lock.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_ID]).catch(() => undefined);
		lock.release();
	}
}

/** PostgreSQL `unique_violation`, also when wrapped by Drizzle. */
export function isUniqueViolation(error: unknown): boolean {
	const candidate = error as { code?: unknown; cause?: { code?: unknown } } | null;
	return candidate?.code === "23505" || candidate?.cause?.code === "23505";
}
