import { type NewSessionRecord, oidcClients, type SessionRecord, sessionApplications, sessions, type UserRecord, users } from "@aegis/db";
import { and, count, desc, eq, gt, inArray, lte, ne, notInArray } from "drizzle-orm";
import type { Database } from "../db/database.js";

export interface SessionWithUser {
	session: SessionRecord;
	user: UserRecord;
}

export interface SessionApplicationRow {
	sessionId: string;
	clientId: string;
	clientName: string;
	clientLogoHash: string | null;
	lastAuthorizedAt: Date;
}

export interface ClientSessionRow extends SessionWithUser {
	firstAuthorizedAt: Date;
	lastAuthorizedAt: Date;
}

/** Aegis browser sessions and the applications each user session signed in to. */
export class SessionRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	public async insert(values: NewSessionRecord): Promise<SessionRecord> {
		const [row] = await this.database.db.insert(sessions).values(values).returning();
		if (!row) {
			throw new Error("Inserting the session returned no row");
		}
		return row;
	}

	public async findActiveByTokenHash(tokenHash: string, now: Date): Promise<SessionWithUser | null> {
		const [row] = await this.database.db
			.select({ session: sessions, user: users })
			.from(sessions)
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
			.limit(1);
		return row ?? null;
	}

	public async findById(id: string): Promise<SessionRecord | null> {
		const [row] = await this.database.db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
		return row ?? null;
	}

	/** Active sessions, most recently used first; all of them or those of one account. */
	public listActive(now: Date, userId?: string): Promise<SessionWithUser[]> {
		return this.database.db
			.select({ session: sessions, user: users })
			.from(sessions)
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(and(gt(sessions.expiresAt, now), userId ? eq(sessions.userId, userId) : undefined))
			.orderBy(desc(sessions.lastSeenAt));
	}

	public async countActive(now: Date): Promise<number> {
		const [row] = await this.database.db.select({ value: count() }).from(sessions).where(gt(sessions.expiresAt, now));
		return row?.value ?? 0;
	}

	public async touch(id: string, at: Date): Promise<void> {
		await this.database.db.update(sessions).set({ lastSeenAt: at }).where(eq(sessions.id, id));
	}

	public async delete(id: string): Promise<boolean> {
		const result = await this.database.db.delete(sessions).where(eq(sessions.id, id));
		return (result.rowCount ?? 0) > 0;
	}

	/** Deletes all sessions of an account, optionally keeping the current one. */
	public async deleteByUser(userId: string, keepSessionId?: string): Promise<number> {
		const result = await this.database.db
			.delete(sessions)
			.where(and(eq(sessions.userId, userId), keepSessionId ? ne(sessions.id, keepSessionId) : undefined));
		return result.rowCount ?? 0;
	}

	/** Deletes the sessions of all accounts. */
	public async deleteAll(): Promise<number> {
		const result = await this.database.db.delete(sessions);
		return result.rowCount ?? 0;
	}

	public async deleteExpired(now: Date): Promise<number> {
		const result = await this.database.db.delete(sessions).where(lte(sessions.expiresAt, now));
		return result.rowCount ?? 0;
	}

	public async recordApplication(sessionId: string, clientId: string, at: Date): Promise<void> {
		await this.database.db
			.insert(sessionApplications)
			.values({ sessionId, clientId, firstAuthorizedAt: at, lastAuthorizedAt: at })
			.onConflictDoUpdate({
				target: [sessionApplications.sessionId, sessionApplications.clientId],
				set: { lastAuthorizedAt: at },
			});
	}

	/** Applications the active sessions signed in to; of all sessions or those of one account. */
	public listActiveApplications(now: Date, userId?: string): Promise<SessionApplicationRow[]> {
		return this.database.db
			.select({
				sessionId: sessionApplications.sessionId,
				clientId: oidcClients.id,
				clientName: oidcClients.name,
				clientLogoHash: oidcClients.logoHash,
				lastAuthorizedAt: sessionApplications.lastAuthorizedAt,
			})
			.from(sessionApplications)
			.innerJoin(sessions, eq(sessions.id, sessionApplications.sessionId))
			.innerJoin(oidcClients, eq(oidcClients.id, sessionApplications.clientId))
			.where(and(gt(sessions.expiresAt, now), userId ? eq(sessions.userId, userId) : undefined))
			.orderBy(desc(sessionApplications.lastAuthorizedAt));
	}

	public listByClient(clientId: string, now: Date): Promise<ClientSessionRow[]> {
		return this.database.db
			.select({
				session: sessions,
				user: users,
				firstAuthorizedAt: sessionApplications.firstAuthorizedAt,
				lastAuthorizedAt: sessionApplications.lastAuthorizedAt,
			})
			.from(sessionApplications)
			.innerJoin(sessions, eq(sessions.id, sessionApplications.sessionId))
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(and(eq(sessionApplications.clientId, clientId), gt(sessions.expiresAt, now)))
			.orderBy(desc(sessionApplications.lastAuthorizedAt));
	}

	/** The sign-in of an active session to an application, with the account it belongs to. */
	public async findByClient(sessionId: string, clientId: string, now: Date): Promise<ClientSessionRow | null> {
		const [row] = await this.database.db
			.select({
				session: sessions,
				user: users,
				firstAuthorizedAt: sessionApplications.firstAuthorizedAt,
				lastAuthorizedAt: sessionApplications.lastAuthorizedAt,
			})
			.from(sessionApplications)
			.innerJoin(sessions, eq(sessions.id, sessionApplications.sessionId))
			.innerJoin(users, eq(users.id, sessions.userId))
			.where(
				and(eq(sessionApplications.sessionId, sessionId), eq(sessionApplications.clientId, clientId), gt(sessions.expiresAt, now)),
			)
			.limit(1);
		return row ?? null;
	}

	public async deleteApplication(sessionId: string, clientId: string): Promise<void> {
		await this.database.db
			.delete(sessionApplications)
			.where(and(eq(sessionApplications.sessionId, sessionId), eq(sessionApplications.clientId, clientId)));
	}

	public async deleteApplicationsByClient(clientId: string): Promise<number> {
		const result = await this.database.db.delete(sessionApplications).where(eq(sessionApplications.clientId, clientId));
		return result.rowCount ?? 0;
	}

	/** Forgets the sign-ins of one account's sessions to an application. */
	public async deleteApplicationsByClientAndUser(clientId: string, userId: string): Promise<void> {
		const sessionsOfUser = this.database.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
		await this.database.db
			.delete(sessionApplications)
			.where(and(eq(sessionApplications.clientId, clientId), inArray(sessionApplications.sessionId, sessionsOfUser)));
	}

	/** Forgets the sign-ins to an application of every account except the given ones. */
	public async deleteApplicationsByClientExceptUsers(clientId: string, keepUserIds: readonly string[]): Promise<void> {
		const sessionsOfOthers = this.database.db
			.select({ id: sessions.id })
			.from(sessions)
			.where(notInArray(sessions.userId, [...keepUserIds]));
		await this.database.db
			.delete(sessionApplications)
			.where(and(eq(sessionApplications.clientId, clientId), inArray(sessionApplications.sessionId, sessionsOfOthers)));
	}
}
