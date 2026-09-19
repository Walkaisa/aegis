import { oidcConsents } from "@aegis/db";
import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db/database.js";

/** Scopes each user approved per application; survives signing out and in again. */
export class ConsentRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	public async find(userId: string, clientId: string): Promise<string[] | null> {
		const [row] = await this.database.db
			.select({ scopes: oidcConsents.scopes })
			.from(oidcConsents)
			.where(and(eq(oidcConsents.userId, userId), eq(oidcConsents.clientId, clientId)))
			.limit(1);
		return row?.scopes ?? null;
	}

	/** Adds scopes to the stored consent, creating it when necessary. */
	public async merge(userId: string, clientId: string, scopes: readonly string[], at: Date): Promise<void> {
		await this.database.db
			.insert(oidcConsents)
			.values({ userId, clientId, scopes: [...scopes], createdAt: at, updatedAt: at })
			.onConflictDoUpdate({
				target: [oidcConsents.userId, oidcConsents.clientId],
				set: {
					scopes: sql`ARRAY(SELECT DISTINCT scope FROM unnest(${oidcConsents.scopes} || excluded.scopes) AS scope ORDER BY scope)`,
					updatedAt: at,
				},
			});
	}
}
