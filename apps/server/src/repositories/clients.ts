import { isSnowflake } from "@aegis/contracts";
import {
	type AegisExecutor,
	clientAssignments,
	type NewOidcClientRecord,
	type OidcClientRecord,
	oidcClients,
	sessionApplications,
	sessions,
} from "@aegis/db";
import { and, asc, count, eq, getTableColumns, gt, sql } from "drizzle-orm";
import type { Database } from "../db/database.js";

export interface ClientSummary extends OidcClientRecord {
	activeSessionCount: number;
	assignedUserCount: number;
}

export type ClientChanges = Partial<
	Pick<
		NewOidcClientRecord,
		| "name"
		| "description"
		| "tokenEndpointAuthMethod"
		| "redirectUris"
		| "postLogoutRedirectUris"
		| "allowedScopes"
		| "skipConsent"
		| "enabled"
		| "accessPolicy"
		| "pkcePolicy"
		| "logoHash"
	>
>;

/**
 * An application with its usage figures. The figures are correlated subqueries built with the query
 * builder, so the columns keep their table qualifier (see `UserRepository`).
 */
const summaryColumns = (executor: AegisExecutor, now: Date) => ({
	...getTableColumns(oidcClients),
	/** Unexpired sessions that signed in to the application. */
	activeSessionCount: sql`(${executor
		.select({ value: count() })
		.from(sessionApplications)
		.innerJoin(sessions, eq(sessions.id, sessionApplications.sessionId))
		.where(and(eq(sessionApplications.clientId, oidcClients.id), gt(sessions.expiresAt, now)))})`.mapWith(Number),
	assignedUserCount: sql`(${executor
		.select({ value: count() })
		.from(clientAssignments)
		.where(eq(clientAssignments.clientId, oidcClients.id))})`.mapWith(Number),
});

export class ClientRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	public list(now: Date): Promise<ClientSummary[]> {
		return this.database.db
			.select(summaryColumns(this.database.db, now))
			.from(oidcClients)
			.orderBy(sql`lower(${oidcClients.name})`, asc(oidcClients.createdAt));
	}

	public async findSummary(id: string, now: Date): Promise<ClientSummary | null> {
		const [row] = await this.database.db
			.select(summaryColumns(this.database.db, now))
			.from(oidcClients)
			.where(eq(oidcClients.id, id))
			.limit(1);
		return row ?? null;
	}

	public async findById(id: string): Promise<OidcClientRecord | null> {
		const [row] = await this.database.db.select().from(oidcClients).where(eq(oidcClients.id, id)).limit(1);
		return row ?? null;
	}

	/**
	 * Looks up an application by the OAuth `client_id` of a request, which is its snowflake. Any other
	 * value is no match rather than a database error.
	 */
	public findByClientId(clientId: string): Promise<OidcClientRecord | null> {
		return isSnowflake(clientId) ? this.findById(clientId) : Promise.resolve(null);
	}

	public async count(): Promise<number> {
		const [row] = await this.database.db.select({ value: count() }).from(oidcClients);
		return row?.value ?? 0;
	}

	public async insert(values: NewOidcClientRecord): Promise<OidcClientRecord> {
		const [row] = await this.database.db.insert(oidcClients).values(values).returning();
		if (!row) {
			throw new Error("Inserting the application returned no row");
		}
		return row;
	}

	public async update(id: string, changes: ClientChanges, at: Date): Promise<OidcClientRecord | null> {
		const [row] = await this.database.db
			.update(oidcClients)
			.set({ ...changes, updatedAt: at })
			.where(eq(oidcClients.id, id))
			.returning();
		return row ?? null;
	}

	public async updateSecret(id: string, clientSecretCiphertext: string, at: Date): Promise<void> {
		await this.database.db
			.update(oidcClients)
			.set({ clientSecretCiphertext, clientSecretRotatedAt: at, updatedAt: at })
			.where(eq(oidcClients.id, id));
	}

	public async touchAuthorized(id: string, at: Date): Promise<void> {
		await this.database.db.update(oidcClients).set({ lastAuthorizedAt: at }).where(eq(oidcClients.id, id));
	}

	public async delete(id: string): Promise<boolean> {
		const result = await this.database.db.delete(oidcClients).where(eq(oidcClients.id, id));
		return (result.rowCount ?? 0) > 0;
	}
}
