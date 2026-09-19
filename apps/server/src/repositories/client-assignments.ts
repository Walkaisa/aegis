import { clientAssignments, type UserRecord, users } from "@aegis/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { Database } from "../db/database.js";

export interface AssignedUserRow {
	user: UserRecord;
	assignedAt: Date;
}

/** Which accounts are assigned to which application. */
export class ClientAssignmentRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	public async exists(clientId: string, userId: string): Promise<boolean> {
		const [row] = await this.database.db
			.select({ userId: clientAssignments.userId })
			.from(clientAssignments)
			.where(and(eq(clientAssignments.clientId, clientId), eq(clientAssignments.userId, userId)))
			.limit(1);
		return row !== undefined;
	}

	/** The accounts assigned to an application, alphabetically. */
	public listUsers(clientId: string): Promise<AssignedUserRow[]> {
		return this.database.db
			.select({ user: users, assignedAt: clientAssignments.createdAt })
			.from(clientAssignments)
			.innerJoin(users, eq(users.id, clientAssignments.userId))
			.where(eq(clientAssignments.clientId, clientId))
			.orderBy(sql`lower(${users.displayName})`, asc(users.createdAt));
	}

	public async listUserIds(clientId: string): Promise<string[]> {
		const rows = await this.database.db
			.select({ userId: clientAssignments.userId })
			.from(clientAssignments)
			.where(eq(clientAssignments.clientId, clientId));
		return rows.map((row) => row.userId);
	}

	/** The applications an account is assigned to. */
	public async listClientIds(userId: string): Promise<string[]> {
		const rows = await this.database.db
			.select({ clientId: clientAssignments.clientId })
			.from(clientAssignments)
			.where(eq(clientAssignments.userId, userId));
		return rows.map((row) => row.clientId);
	}

	/** Returns `false` when the account was assigned already. */
	public async insert(clientId: string, userId: string, at: Date): Promise<boolean> {
		const result = await this.database.db.insert(clientAssignments).values({ clientId, userId, createdAt: at }).onConflictDoNothing();
		return (result.rowCount ?? 0) > 0;
	}

	/** Returns `false` when the account was not assigned. */
	public async delete(clientId: string, userId: string): Promise<boolean> {
		const result = await this.database.db
			.delete(clientAssignments)
			.where(and(eq(clientAssignments.clientId, clientId), eq(clientAssignments.userId, userId)));
		return (result.rowCount ?? 0) > 0;
	}
}
