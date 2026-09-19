import type { ClientCreateRequest, ClientUpdateRequest } from "@aegis/contracts";
import type { OidcClientRecord, UserRecord } from "@aegis/db";
import type { Encryptor } from "../crypto/encryption.js";
import { randomToken } from "../crypto/tokens.js";
import type { Database } from "../db/database.js";
import { ApiError, notFound } from "../lib/errors.js";
import { newId } from "../lib/snowflakes.js";
import { clientSecretContext } from "../oidc/client-metadata.js";
import type { AuditLog } from "../repositories/audit.js";
import type { ClientAssignmentRepository } from "../repositories/client-assignments.js";
import type { ClientRepository, ClientSummary } from "../repositories/clients.js";
import type { SessionRepository } from "../repositories/sessions.js";
import type { UserRepository } from "../repositories/users.js";
import type { ApplicationAccess } from "./application-access.js";
import type { RequestMeta } from "./auth.js";
import type { AccessRevoker } from "./revocation.js";
import { accountReference } from "./users.js";

const CLIENT_SECRET_BYTES = 32;

/** Audit reference of an application. The name keeps history readable after a deletion. */
export function clientReference(client: Pick<OidcClientRecord, "id" | "name">) {
	return { id: client.id, label: client.name };
}

export interface ClientServiceDependencies {
	database: Database;
	clients: ClientRepository;
	users: UserRepository;
	sessions: SessionRepository;
	assignments: ClientAssignmentRepository;
	access: ApplicationAccess;
	encryptor: Encryptor;
	revoker: AccessRevoker;
	audit: AuditLog;
}

/**
 * Management of applications (OIDC clients). A client secret exists in plaintext only in the
 * result of creating the application or rotating its secret.
 */
export class ClientService {
	private readonly deps: ClientServiceDependencies;

	public constructor(deps: ClientServiceDependencies) {
		this.deps = deps;
	}

	/** The application with its usage figures. */
	public async find(id: string): Promise<ClientSummary> {
		const client = await this.deps.clients.findSummary(id, new Date());
		if (!client) {
			throw notFound("Application");
		}
		return client;
	}

	/** Creates an enabled application; confidential clients get a secret. */
	public async create(
		input: ClientCreateRequest,
		actor: UserRecord,
		meta: RequestMeta,
	): Promise<{ client: OidcClientRecord; secret: string | null }> {
		const { clients, encryptor, audit } = this.deps;
		const now = new Date();
		const id = newId();
		const secret = input.type === "confidential" ? randomToken(CLIENT_SECRET_BYTES) : null;

		const client = await clients.insert({
			id,
			name: input.name,
			description: input.description,
			clientType: input.type,
			tokenEndpointAuthMethod: input.type === "confidential" ? input.tokenEndpointAuthMethod : "none",
			clientSecretCiphertext: secret ? encryptor.encrypt(secret, clientSecretContext(id)) : null,
			clientSecretRotatedAt: secret ? now : null,
			redirectUris: input.redirectUris,
			postLogoutRedirectUris: input.postLogoutRedirectUris,
			allowedScopes: input.allowedScopes,
			skipConsent: input.skipConsent,
			enabled: true,
			accessPolicy: input.accessPolicy,
			pkcePolicy: input.pkcePolicy,
			createdAt: now,
			updatedAt: now,
		});

		await audit.record({
			type: "client.created",
			actor: accountReference(actor),
			client: clientReference(client),
			meta,
			metadata: {
				type: client.clientType,
				scopes: client.allowedScopes,
				accessPolicy: client.accessPolicy,
				pkcePolicy: client.pkcePolicy,
			},
		});
		return { client, secret };
	}

	/**
	 * Replaces the settings of an application; the type never changes. Accounts that lose access, because
	 * the application is disabled or restricted, lose their sign-ins, grants and tokens right away.
	 */
	public async update(
		existing: OidcClientRecord,
		input: ClientUpdateRequest,
		actor: UserRecord,
		meta: RequestMeta,
	): Promise<OidcClientRecord> {
		const { clients, access, revoker, audit } = this.deps;
		const updated = await clients.update(
			existing.id,
			{
				name: input.name,
				description: input.description,
				tokenEndpointAuthMethod: existing.clientType === "confidential" ? input.tokenEndpointAuthMethod : "none",
				redirectUris: input.redirectUris,
				postLogoutRedirectUris: input.postLogoutRedirectUris,
				allowedScopes: input.allowedScopes,
				skipConsent: input.skipConsent,
				enabled: input.enabled,
				accessPolicy: input.accessPolicy,
				pkcePolicy: input.pkcePolicy,
			},
			new Date(),
		);
		if (!updated) {
			throw notFound("Application");
		}

		if (existing.enabled && !updated.enabled) {
			await revoker.revokeClient(existing);
		} else if (existing.accessPolicy !== updated.accessPolicy) {
			const allowed = await access.allowedAccountIds(updated);
			if (allowed) {
				await revoker.revokeClientExcept(updated, allowed);
			}
		}

		await audit.record({
			type: "client.updated",
			actor: accountReference(actor),
			client: clientReference(updated),
			meta,
			metadata: {
				enabled: updated.enabled,
				scopes: updated.allowedScopes,
				accessPolicy: updated.accessPolicy,
				pkcePolicy: updated.pkcePolicy,
			},
		});
		return updated;
	}

	/** Replaces the secret of a confidential client and returns the new plaintext secret. */
	public async rotateSecret(client: OidcClientRecord, actor: UserRecord, meta: RequestMeta): Promise<string> {
		const { clients, encryptor, audit } = this.deps;
		if (client.clientType !== "confidential") {
			throw new ApiError(400, "bad_request", "Public clients do not have a client secret");
		}

		const secret = randomToken(CLIENT_SECRET_BYTES);
		await clients.updateSecret(client.id, encryptor.encrypt(secret, clientSecretContext(client.id)), new Date());
		await audit.record({
			type: "client.secret_rotated",
			actor: accountReference(actor),
			client: clientReference(client),
			meta,
		});
		return secret;
	}

	public delete(client: OidcClientRecord, actor: UserRecord, meta: RequestMeta): Promise<void> {
		const { database, clients, revoker, audit } = this.deps;

		return database.transaction(async () => {
			// Recorded first: the reference to the application is set to NULL once it is gone.
			await audit.record({
				type: "client.deleted",
				actor: accountReference(actor),
				client: clientReference(client),
				meta,
			});
			await revoker.revokeClient(client);
			await clients.delete(client.id);
		});
	}

	/** Revokes all grants and tokens of the application; every account must authorize it again. */
	public async revokeSessions(client: OidcClientRecord, actor: UserRecord, meta: RequestMeta): Promise<void> {
		const { revoker, audit } = this.deps;
		await revoker.revokeClient(client);
		await audit.record({
			type: "client.sessions_revoked",
			actor: accountReference(actor),
			client: clientReference(client),
			meta,
		});
	}

	/** Ends the sign-in of a single session to the application; its account must authorize it again. */
	public async revokeSession(client: OidcClientRecord, sessionId: string, actor: UserRecord, meta: RequestMeta): Promise<void> {
		const { sessions, revoker, audit } = this.deps;
		const row = await sessions.findByClient(sessionId, client.id, new Date());
		if (!row) {
			throw notFound("Session");
		}

		await revoker.revokeClientSession(client, row.session);
		await audit.record({
			type: "client.session_revoked",
			actor: accountReference(actor),
			subject: accountReference(row.user),
			client: clientReference(client),
			meta,
		});
	}

	/** Assigns an account to the application. Assigning it again changes nothing. */
	public async assign(client: OidcClientRecord, userId: string, actor: UserRecord, meta: RequestMeta): Promise<void> {
		const { users, assignments, audit } = this.deps;
		const user = await users.findById(userId);
		if (!user) {
			throw notFound("Account");
		}
		if (!(await assignments.insert(client.id, user.id, new Date()))) {
			return;
		}

		await audit.record({
			type: "client.user_assigned",
			actor: accountReference(actor),
			subject: accountReference(user),
			client: clientReference(client),
			meta,
		});
	}

	/**
	 * Removes the assignment of an account. If that takes its access away, its sign-ins, grants and
	 * tokens for the application end as well. Removing a missing assignment changes nothing.
	 */
	public async unassign(client: OidcClientRecord, userId: string, actor: UserRecord, meta: RequestMeta): Promise<void> {
		const { database, users, assignments, access, revoker, audit } = this.deps;
		const user = await users.findById(userId);
		if (!user) {
			throw notFound("Account");
		}

		await database.transaction(async () => {
			if (!(await assignments.delete(client.id, user.id))) {
				return;
			}
			if (!(await access.allows(user, client))) {
				await revoker.revokeClientAccount(client, user.id);
			}
			await audit.record({
				type: "client.user_unassigned",
				actor: accountReference(actor),
				subject: accountReference(user),
				client: clientReference(client),
				meta,
			});
		});
	}
}
