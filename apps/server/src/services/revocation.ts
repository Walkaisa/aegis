import type { Database } from "../db/database.js";
import type { OidcArtifactRepository } from "../repositories/oidc-artifacts.js";
import type { SessionRepository } from "../repositories/sessions.js";

/** Central place for terminating access: Aegis sessions, provider sessions, grants and tokens. */
export class AccessRevoker {
	private readonly database: Database;
	private readonly sessions: SessionRepository;
	private readonly oidcArtifacts: OidcArtifactRepository;

	public constructor(database: Database, deps: { sessions: SessionRepository; oidcArtifacts: OidcArtifactRepository }) {
		this.database = database;
		this.sessions = deps.sessions;
		this.oidcArtifacts = deps.oidcArtifacts;
	}

	/**
	 * Ends the sessions of an account (optionally except the current one) and invalidates its
	 * provider sessions, grants, authorization codes and tokens. Returns the ended session count.
	 */
	public revokeUser(userId: string, options: { keepSessionId?: string } = {}): Promise<number> {
		return this.database.transaction(async () => {
			const revoked = await this.sessions.deleteByUser(userId, options.keepSessionId);
			await this.oidcArtifacts.deleteByAccount(userId);
			return revoked;
		});
	}

	/**
	 * Ends the sessions of all accounts and invalidates all provider sessions, grants, authorization
	 * codes and tokens. Returns the ended session count.
	 */
	public revokeAll(): Promise<number> {
		return this.database.transaction(async () => {
			const revoked = await this.sessions.deleteAll();
			await this.oidcArtifacts.deleteAllAccounts();
			return revoked;
		});
	}

	/**
	 * Ends the sign-in of one session to an application. Tokens are issued per account, not per
	 * browser session, so all grants and tokens of that account for the application become invalid.
	 */
	public revokeClientSession(client: { id: string }, session: { id: string; userId: string }): Promise<void> {
		return this.database.transaction(async () => {
			await this.oidcArtifacts.deleteByClientAndAccount(client.id, session.userId);
			await this.sessions.deleteApplication(session.id, client.id);
		});
	}

	/** Invalidates all grants and tokens of an application and forgets its sign-ins. */
	public revokeClient(client: { id: string }): Promise<void> {
		return this.database.transaction(async () => {
			await this.oidcArtifacts.deleteByClient(client.id);
			await this.sessions.deleteApplicationsByClient(client.id);
		});
	}

	/**
	 * Removes everything a deleted application leaves behind in the provider: grants, codes, tokens,
	 * sign-ins still in progress and its entry in every provider session.
	 */
	public removeClient(client: { id: string }): Promise<void> {
		return this.database.transaction(async () => {
			await this.oidcArtifacts.deleteByClient(client.id);
			await this.oidcArtifacts.deleteClientReferences(client.id);
		});
	}

	/** Ends the sign-ins of one account to an application and invalidates its grants and tokens there. */
	public revokeClientAccount(client: { id: string }, userId: string): Promise<void> {
		return this.database.transaction(async () => {
			await this.oidcArtifacts.deleteByClientAndAccount(client.id, userId);
			await this.sessions.deleteApplicationsByClientAndUser(client.id, userId);
		});
	}

	/** Like `revokeClient`, but keeps the sign-ins, grants and tokens of the given accounts. */
	public revokeClientExcept(client: { id: string }, keepUserIds: readonly string[]): Promise<void> {
		return this.database.transaction(async () => {
			await this.oidcArtifacts.deleteByClientExceptAccounts(client.id, keepUserIds);
			await this.sessions.deleteApplicationsByClientExceptUsers(client.id, keepUserIds);
		});
	}
}
