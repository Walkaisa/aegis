import { type CookieKeyRecord, cookieKeys, type SigningKeyRecord, signingKeys } from "@aegis/db";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import type { Database } from "../db/database.js";

export class KeyRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	/** Active key first, then retired keys from newest to oldest. */
	public listSigningKeys(): Promise<SigningKeyRecord[]> {
		return this.database.db.select().from(signingKeys).orderBy(sql`${signingKeys.status} = 'active' DESC`, desc(signingKeys.createdAt));
	}

	public async insertSigningKey(key: SigningKeyRecord): Promise<void> {
		await this.database.db.insert(signingKeys).values(key);
	}

	/** Retires the current key and activates `next` atomically. */
	public rotateSigningKey(next: SigningKeyRecord, at: Date): Promise<void> {
		return this.database.transaction(async () => {
			await this.database.db.update(signingKeys).set({ status: "retired", retiredAt: at }).where(eq(signingKeys.status, "active"));
			await this.insertSigningKey(next);
		});
	}

	public async deleteRetiredSigningKeysBefore(cutoff: Date): Promise<number> {
		const result = await this.database.db
			.delete(signingKeys)
			.where(and(eq(signingKeys.status, "retired"), lte(signingKeys.retiredAt, cutoff)));
		return result.rowCount ?? 0;
	}

	/** Newest key first; oidc-provider signs cookies with the first key and verifies with all. */
	public listCookieKeys(): Promise<CookieKeyRecord[]> {
		return this.database.db.select().from(cookieKeys).orderBy(desc(cookieKeys.createdAt));
	}

	public async insertCookieKey(key: CookieKeyRecord): Promise<void> {
		await this.database.db.insert(cookieKeys).values(key);
	}
}
