import { AsyncLocalStorage } from "node:async_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { type AegisDatabase, type AegisExecutor, type AegisTransaction, createDatabase, createPool, runMigrations } from "@aegis/db";
import type { FastifyBaseLogger } from "fastify";

const CONNECT_TIMEOUT_MS = 60_000;

/**
 * The Drizzle database with ambient transactions: inside `transaction()`, `db` resolves to the
 * open transaction, so repositories never pass transaction handles around.
 */
export class Database {
	private readonly pool: ReturnType<typeof createPool>;
	private readonly root: AegisDatabase;
	private readonly activeTransaction = new AsyncLocalStorage<AegisTransaction>();

	public constructor(connectionString: string, log: FastifyBaseLogger) {
		this.pool = createPool(connectionString);
		this.pool.on("error", (error) => log.error({ err: error }, "PostgreSQL connection error"));
		this.root = createDatabase(this.pool);
	}

	public get db(): AegisExecutor {
		return this.activeTransaction.getStore() ?? this.root;
	}

	public transaction<T>(work: () => Promise<T>): Promise<T> {
		if (this.activeTransaction.getStore()) {
			return work();
		}
		return this.root.transaction((transaction) => this.activeTransaction.run(transaction, work));
	}

	public async ping(): Promise<void> {
		await this.pool.query("SELECT 1");
	}

	public migrate(): Promise<void> {
		return runMigrations(this.pool, this.root);
	}

	public close(): Promise<void> {
		return this.pool.end();
	}
}

/** Connects (waiting for PostgreSQL to become available) and applies pending migrations. */
export async function openDatabase(connectionString: string, log: FastifyBaseLogger): Promise<Database> {
	const database = new Database(connectionString, log);
	const deadline = Date.now() + CONNECT_TIMEOUT_MS;

	for (let attempt = 1; ; attempt += 1) {
		try {
			await database.ping();
			break;
		} catch (error) {
			if (Date.now() >= deadline) {
				await database.close();
				throw error;
			}
			log.warn({ attempt, err: error }, "Waiting for PostgreSQL");
			await sleep(Math.min(attempt * 1_000, 5_000));
		}
	}

	try {
		await database.migrate();
	} catch (error) {
		await database.close();
		throw error;
	}
	return database;
}
