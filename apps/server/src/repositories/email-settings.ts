import { type EmailSettingsRecord, emailSettings } from "@aegis/db";
import { eq } from "drizzle-orm";
import type { Database } from "../db/database.js";

export type EmailSettingsValues = Omit<EmailSettingsRecord, "id" | "createdAt" | "updatedAt">;

/**
 * The SMTP server, cached in memory like the instance settings: every outgoing message reads it,
 * and it changes only when an admin saves the form. A missing row means no server is configured.
 */
export class EmailSettingsRepository {
	private readonly database: Database;
	private cache: EmailSettingsRecord | null = null;

	public constructor(database: Database) {
		this.database = database;
	}

	public async refresh(): Promise<EmailSettingsRecord | null> {
		const [row] = await this.database.db.select().from(emailSettings).where(eq(emailSettings.id, 1)).limit(1);
		this.cache = row ?? null;
		return this.cache;
	}

	public get(): EmailSettingsRecord | null {
		return this.cache;
	}

	/** The settings to send with, or `null` while sending is off or nothing is configured. */
	public getActive(): EmailSettingsRecord | null {
		return this.cache?.enabled ? this.cache : null;
	}

	/** Writes the single row, creating it on the first save. */
	public async save(values: EmailSettingsValues, at: Date): Promise<EmailSettingsRecord> {
		const [row] = await this.database.db
			.insert(emailSettings)
			.values({ id: 1, ...values, createdAt: at, updatedAt: at })
			.onConflictDoUpdate({ target: emailSettings.id, set: { ...values, updatedAt: at } })
			.returning();
		if (!row) {
			throw new Error("Saving the e-mail settings returned no row");
		}
		this.cache = row;
		return row;
	}
}
