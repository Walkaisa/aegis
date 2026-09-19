import { hasPermission, ROLES } from "@aegis/contracts";
import type { OidcClientRecord, UserRecord } from "@aegis/db";
import type { ClientAssignmentRepository } from "../repositories/client-assignments.js";
import type { ClientRepository } from "../repositories/clients.js";
import type { UserRepository } from "../repositories/users.js";

/** Roles that manage applications. They could assign themselves anyway, so they may sign in everywhere. */
const UNRESTRICTED_ROLES = ROLES.filter((role) => hasPermission(role, "applications:manage"));

export interface AccountApplication {
	client: OidcClientRecord;
	assigned: boolean;
	canSignIn: boolean;
}

/**
 * Who may sign in to which application. Signing in requires `applications:sign_in`; beyond that,
 * accounts that manage applications may sign in to all of them, and every other account to the
 * applications open to everyone and to those it is assigned to.
 */
export class ApplicationAccess {
	private readonly deps: { users: UserRepository; clients: ClientRepository; assignments: ClientAssignmentRepository };

	public constructor(deps: ApplicationAccess["deps"]) {
		this.deps = deps;
	}

	public async allows(user: UserRecord, client: OidcClientRecord): Promise<boolean> {
		if (decide(user, client, false)) {
			return true;
		}
		// Only an assignment can still grant access.
		return decide(user, client, true) && this.deps.assignments.exists(client.id, user.id);
	}

	/** Every application, with whether the account is assigned to it and may sign in. */
	public async applicationsOf(user: UserRecord): Promise<AccountApplication[]> {
		const [clients, assignedIds] = await Promise.all([
			this.deps.clients.list(new Date()),
			this.deps.assignments.listClientIds(user.id),
		]);
		const assigned = new Set(assignedIds);
		return clients.map((client) => ({
			client,
			assigned: assigned.has(client.id),
			canSignIn: decide(user, client, assigned.has(client.id)),
		}));
	}

	/** The accounts that may sign in to the application, or `null` while it is open to everyone. */
	public async allowedAccountIds(client: OidcClientRecord): Promise<string[] | null> {
		if (client.accessPolicy === "everyone") {
			return null;
		}
		const [unrestricted, assigned] = await Promise.all([
			this.deps.users.listIdsByRole(UNRESTRICTED_ROLES),
			this.deps.assignments.listUserIds(client.id),
		]);
		return [...new Set([...unrestricted, ...assigned])];
	}
}

function decide(user: Pick<UserRecord, "role">, client: Pick<OidcClientRecord, "accessPolicy">, assigned: boolean): boolean {
	if (!hasPermission(user.role, "applications:sign_in")) {
		return false;
	}
	return client.accessPolicy === "everyone" || UNRESTRICTED_ROLES.includes(user.role) || assigned;
}
