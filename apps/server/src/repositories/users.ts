import { isSnowflake, type Role } from "@aegis/contracts";
import { type AegisExecutor, type NewUserRecord, sessions, type UserRecord, users } from "@aegis/db";
import { and, asc, count, eq, getTableColumns, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Database } from "../db/database.js";

export interface UserSummary extends UserRecord {
	activeSessionCount: number;
	/** The only enabled admin; it can neither be deleted, disabled nor turned into a user. */
	isLastActiveAdmin: boolean;
}

export type UserChanges = Partial<
	Pick<
		NewUserRecord,
		| "email"
		| "emailNormalized"
		| "displayName"
		| "passwordHash"
		| "role"
		| "enabled"
		| "emailVerified"
		| "passwordChangedAt"
		| "avatarHash"
		| "totpSecret"
		| "totpEnabledAt"
		| "totpLabel"
		| "totpLastCounter"
	>
>;

/**
 * Correlated subquery counting the account's unexpired sessions. It is built with the query
 * builder because embedding columns in a raw `sql` fragment drops their table qualifier, which
 * would silently resolve `users.id` against the subquery's own table.
 */
const activeSessionCount = (executor: AegisExecutor, now: Date) =>
	sql`(${executor
		.select({ value: count() })
		.from(sessions)
		.where(and(eq(sessions.userId, users.id), gt(sessions.expiresAt, now)))})`.mapWith(Number);

const otherAdmins = alias(users, "other_admins");

/** True for the one enabled admin when no other enabled admin exists. */
const isLastActiveAdmin = (executor: AegisExecutor) =>
	sql<boolean>`(${users.role} = 'admin' AND ${users.enabled} AND NOT EXISTS (${executor
		.select({ id: otherAdmins.id })
		.from(otherAdmins)
		.where(and(eq(otherAdmins.role, "admin"), eq(otherAdmins.enabled, true), sql`${otherAdmins.id} <> ${users.id}`))}))`.mapWith(
		Boolean,
	);

export class UserRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	/** Also used for OIDC subjects, which arrive as arbitrary strings. */
	public async findById(id: string): Promise<UserRecord | null> {
		if (!isSnowflake(id)) {
			return null;
		}
		const [row] = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1);
		return row ?? null;
	}

	public async findByEmail(emailNormalized: string): Promise<UserRecord | null> {
		const [row] = await this.database.db.select().from(users).where(eq(users.emailNormalized, emailNormalized)).limit(1);
		return row ?? null;
	}

	/** Admins first, then users; each alphabetically. */
	public list(now: Date): Promise<UserSummary[]> {
		return this.database.db
			.select({
				...getTableColumns(users),
				activeSessionCount: activeSessionCount(this.database.db, now),
				isLastActiveAdmin: isLastActiveAdmin(this.database.db),
			})
			.from(users)
			.orderBy(asc(users.role), sql`lower(${users.displayName})`, asc(users.createdAt));
	}

	public async findSummary(id: string, now: Date): Promise<UserSummary | null> {
		const [row] = await this.database.db
			.select({
				...getTableColumns(users),
				activeSessionCount: activeSessionCount(this.database.db, now),
				isLastActiveAdmin: isLastActiveAdmin(this.database.db),
			})
			.from(users)
			.where(eq(users.id, id))
			.limit(1);
		return row ?? null;
	}

	public async countByRole(role: Role): Promise<number> {
		const [row] = await this.database.db.select({ value: count() }).from(users).where(eq(users.role, role));
		return row?.value ?? 0;
	}

	public async listIdsByRole(roles: readonly Role[]): Promise<string[]> {
		const rows = await this.database.db
			.select({ id: users.id })
			.from(users)
			.where(inArray(users.role, [...roles]));
		return rows.map((row) => row.id);
	}

	/**
	 * Locks the rows of all enabled admins until the surrounding transaction ends. Concurrent
	 * changes that could remove the last active admin are serialized this way.
	 */
	public async lockActiveAdminIds(): Promise<string[]> {
		const rows = await this.database.db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.role, "admin"), eq(users.enabled, true)))
			.for("update");
		return rows.map((row) => row.id);
	}

	public async insert(values: NewUserRecord): Promise<UserRecord> {
		const [row] = await this.database.db.insert(users).values(values).returning();
		if (!row) {
			throw new Error("Inserting the user returned no row");
		}
		return row;
	}

	public async update(id: string, changes: UserChanges, at: Date): Promise<UserRecord | null> {
		const [row] = await this.database.db
			.update(users)
			.set({ ...changes, updatedAt: at })
			.where(eq(users.id, id))
			.returning();
		return row ?? null;
	}

	/** Transparent rehash with updated Argon2 parameters; not a password change. */
	public async replacePasswordHash(id: string, passwordHash: string): Promise<void> {
		await this.database.db.update(users).set({ passwordHash }).where(eq(users.id, id));
	}

	/**
	 * Records the time step of an accepted authenticator code. Fails for a time step that is not newer
	 * than the last accepted one, so a code cannot be used twice, not even by concurrent requests.
	 */
	public async claimTotpCounter(id: string, counter: number): Promise<boolean> {
		const rows = await this.database.db
			.update(users)
			.set({ totpLastCounter: counter })
			.where(and(eq(users.id, id), or(isNull(users.totpLastCounter), lt(users.totpLastCounter, counter))))
			.returning({ id: users.id });
		return rows.length > 0;
	}

	public async touchSignIn(id: string, at: Date): Promise<void> {
		await this.database.db.update(users).set({ lastSignInAt: at }).where(eq(users.id, id));
	}

	public async delete(id: string): Promise<boolean> {
		const result = await this.database.db.delete(users).where(eq(users.id, id));
		return (result.rowCount ?? 0) > 0;
	}

	public async countActiveSessions(id: string, now: Date): Promise<number> {
		const [row] = await this.database.db
			.select({ value: count() })
			.from(sessions)
			.where(and(eq(sessions.userId, id), gt(sessions.expiresAt, now)));
		return row?.value ?? 0;
	}
}
