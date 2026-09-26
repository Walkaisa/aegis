import { type AccountTokenPurpose, type AccountTokenRecord, accountTokens, type UserRecord, users } from "@aegis/db";
import { and, desc, eq, gt, isNull, lte } from "drizzle-orm";
import type { Database } from "../db/database.js";

export type AccountTokenInsert = Omit<AccountTokenRecord, "consumedAt">;

/** A token together with the account it belongs to; both are needed wherever one is redeemed. */
export interface AccountTokenWithUser {
	token: AccountTokenRecord;
	user: UserRecord;
}

/**
 * The single-use links of the password reset and e-mail change flows. Lookups go through the
 * token hash only — the plain token exists in the recipient's mailbox and nowhere else.
 */
export class AccountTokenRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	public async insert(values: AccountTokenInsert): Promise<AccountTokenRecord> {
		const [row] = await this.database.db.insert(accountTokens).values(values).returning();
		if (!row) {
			throw new Error("Inserting the account token returned no row");
		}
		return row;
	}

	/** A token by its hash, whether it is still open, spent or expired. */
	public async find(tokenHash: string, purpose: AccountTokenPurpose): Promise<AccountTokenWithUser | null> {
		const [row] = await this.database.db
			.select({ token: accountTokens, user: users })
			.from(accountTokens)
			.innerJoin(users, eq(users.id, accountTokens.userId))
			.where(and(eq(accountTokens.tokenHash, tokenHash), eq(accountTokens.purpose, purpose)))
			.limit(1);
		return row ?? null;
	}

	/**
	 * Marks an open token as spent. Returns `false` when another request got there first or the
	 * token expired in the meantime, which is what makes a link single-use even under concurrent clicks.
	 */
	public async consume(id: string, at: Date): Promise<boolean> {
		const rows = await this.database.db
			.update(accountTokens)
			.set({ consumedAt: at })
			.where(and(eq(accountTokens.id, id), isNull(accountTokens.consumedAt), gt(accountTokens.expiresAt, at)))
			.returning({ id: accountTokens.id });
		return rows.length > 0;
	}

	/** The open token of a purpose, e.g. to show a pending e-mail change or to resend its link. */
	public async findOpenForUser(userId: string, purpose: AccountTokenPurpose, now: Date): Promise<AccountTokenRecord | null> {
		const [row] = await this.database.db
			.select()
			.from(accountTokens)
			.where(
				and(
					eq(accountTokens.userId, userId),
					eq(accountTokens.purpose, purpose),
					isNull(accountTokens.consumedAt),
					gt(accountTokens.expiresAt, now),
				),
			)
			.orderBy(desc(accountTokens.createdAt))
			.limit(1);
		return row ?? null;
	}

	/** Drops the account's tokens of a purpose; issuing a new link invalidates the previous one. */
	public async deleteFor(userId: string, purpose: AccountTokenPurpose): Promise<void> {
		await this.database.db.delete(accountTokens).where(and(eq(accountTokens.userId, userId), eq(accountTokens.purpose, purpose)));
	}

	/** Drops every link of the account that has not been redeemed yet, whatever it was sent for. */
	public async deleteOpenForUser(userId: string): Promise<void> {
		await this.database.db.delete(accountTokens).where(and(eq(accountTokens.userId, userId), isNull(accountTokens.consumedAt)));
	}

	/** Expired e-mail changes to an address; until the maintenance run removes them they still claim it. */
	public async deleteExpiredForTarget(targetEmailNormalized: string, now: Date): Promise<void> {
		await this.database.db
			.delete(accountTokens)
			.where(and(eq(accountTokens.targetEmailNormalized, targetEmailNormalized), lte(accountTokens.expiresAt, now)));
	}

	/**
	 * Expired tokens, removed by the maintenance run. Spent ones are kept until they expire as
	 * well, so a link that is clicked twice stays distinguishable from one that was never issued.
	 */
	public async deleteExpired(now: Date): Promise<number> {
		const result = await this.database.db.delete(accountTokens).where(lte(accountTokens.expiresAt, now));
		return result.rowCount ?? 0;
	}
}
