import { type SystemSettingsRecord, systemSettings } from "@aegis/db";
import { eq } from "drizzle-orm";
import type { Database } from "../db/database.js";

/**
 * Instance settings, cached in memory. The row is written by the initial setup; while it is
 * missing, Aegis is in setup mode.
 */
export class SettingsRepository {
	private readonly database: Database;
	private cache: SystemSettingsRecord | null = null;

	public constructor(database: Database) {
		this.database = database;
	}

	public async refresh(): Promise<SystemSettingsRecord | null> {
		const [row] = await this.database.db.select().from(systemSettings).where(eq(systemSettings.id, 1)).limit(1);
		this.cache = row ?? null;
		return this.cache;
	}

	public get(): SystemSettingsRecord | null {
		return this.cache;
	}

	public isSetupComplete(): boolean {
		return this.cache !== null;
	}

	public async insert(values: Omit<SystemSettingsRecord, "id">): Promise<void> {
		await this.database.db.insert(systemSettings).values({ id: 1, ...values });
	}

	public async update(
		fields: { instanceName: string; sessionTtlSeconds: number; auditRetentionDays: number },
		at: Date,
	): Promise<SystemSettingsRecord | null> {
		await this.database.db
			.update(systemSettings)
			.set({ ...fields, updatedAt: at })
			.where(eq(systemSettings.id, 1));
		return this.refresh();
	}
}
