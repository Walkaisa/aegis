import { recoveryCodes } from "@aegis/db";
import { and, count, eq, isNull } from "drizzle-orm";
import type { Database } from "../db/database.js";
import { newId } from "../lib/snowflakes.js";

/** Hashed one-time recovery codes for two-factor authentication. */
export class RecoveryCodeRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	/** Replaces all codes of an account, used or not, with a new set. */
	public async replace(userId: string, codeHashes: readonly string[], at: Date): Promise<void> {
		await this.database.transaction(async () => {
			await this.deleteByUser(userId);
			await this.database.db
				.insert(recoveryCodes)
				.values(codeHashes.map((codeHash) => ({ id: newId(), userId, codeHash, createdAt: at })));
		});
	}

	public async countUnused(userId: string): Promise<number> {
		const [row] = await this.database.db
			.select({ value: count() })
			.from(recoveryCodes)
			.where(and(eq(recoveryCodes.userId, userId), isNull(recoveryCodes.usedAt)));
		return row?.value ?? 0;
	}

	/** Marks an unused code as used; false if it does not exist or was used before, even concurrently. */
	public async consume(userId: string, codeHash: string, at: Date): Promise<boolean> {
		const rows = await this.database.db
			.update(recoveryCodes)
			.set({ usedAt: at })
			.where(and(eq(recoveryCodes.userId, userId), eq(recoveryCodes.codeHash, codeHash), isNull(recoveryCodes.usedAt)))
			.returning({ id: recoveryCodes.id });
		return rows.length > 0;
	}

	public async deleteByUser(userId: string): Promise<void> {
		await this.database.db.delete(recoveryCodes).where(eq(recoveryCodes.userId, userId));
	}
}
