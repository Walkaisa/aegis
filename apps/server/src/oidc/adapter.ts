import type { Adapter, AdapterPayload } from "oidc-provider";
import type { Encryptor } from "../crypto/encryption.js";
import { toEpochSeconds } from "../lib/time.js";
import type { ClientRepository } from "../repositories/clients.js";
import type { OidcArtifactRepository, StoredArtifact } from "../repositories/oidc-artifacts.js";
import { toClientMetadata } from "./client-metadata.js";

function toPayload(stored: StoredArtifact | null): AdapterPayload | undefined {
	if (!stored) {
		return undefined;
	}
	const payload = stored.payload as AdapterPayload;
	return stored.consumedAt === null ? payload : { ...payload, consumed: toEpochSeconds(stored.consumedAt) };
}

/** PostgreSQL persistence for all oidc-provider models except clients. */
class ArtifactAdapter implements Adapter {
	private readonly model: string;
	private readonly repository: OidcArtifactRepository;

	public constructor(model: string, repository: OidcArtifactRepository) {
		this.model = model;
		this.repository = repository;
	}

	public async upsert(id: string, payload: AdapterPayload, expiresIn?: number): Promise<void> {
		const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 1000) : null;
		await this.repository.upsert(this.model, id, payload as Record<string, unknown>, expiresAt);
	}

	public async find(id: string): Promise<AdapterPayload | undefined> {
		return toPayload(await this.repository.find(this.model, id, new Date()));
	}

	public async findByUserCode(userCode: string): Promise<AdapterPayload | undefined> {
		return toPayload(await this.repository.findByUserCode(this.model, userCode, new Date()));
	}

	public async findByUid(uid: string): Promise<AdapterPayload | undefined> {
		return toPayload(await this.repository.findByUid(this.model, uid, new Date()));
	}

	public consume(id: string): Promise<void> {
		return this.repository.consume(this.model, id, new Date());
	}

	public destroy(id: string): Promise<void> {
		return this.repository.destroy(this.model, id);
	}

	public revokeByGrantId(grantId: string): Promise<void> {
		return this.repository.revokeByGrantId(this.model, grantId);
	}
}

/**
 * Read-only client lookup backed by `oidc_clients`. Applications are managed exclusively through
 * the administration UI; dynamic client registration is disabled.
 */
class ClientAdapter implements Adapter {
	private readonly clients: ClientRepository;
	private readonly encryptor: Encryptor;

	public constructor(clients: ClientRepository, encryptor: Encryptor) {
		this.clients = clients;
		this.encryptor = encryptor;
	}

	public async find(clientId: string): Promise<AdapterPayload | undefined> {
		const client = await this.clients.findByClientId(clientId);
		if (!client?.enabled) {
			return undefined;
		}
		return toClientMetadata(client, this.encryptor);
	}

	public async upsert(): Promise<void> {
		throw new Error("Clients are managed by Aegis and cannot be written by oidc-provider");
	}

	public async findByUserCode(): Promise<undefined> {
		return undefined;
	}

	public async findByUid(): Promise<undefined> {
		return undefined;
	}

	public async consume(): Promise<void> {}

	public async destroy(): Promise<void> {
		throw new Error("Clients are managed by Aegis and cannot be deleted by oidc-provider");
	}

	public async revokeByGrantId(): Promise<void> {}
}

export function createAdapterFactory(deps: {
	oidcArtifacts: OidcArtifactRepository;
	clients: ClientRepository;
	encryptor: Encryptor;
}): (name: string) => Adapter {
	return (name: string) =>
		name === "Client" ? new ClientAdapter(deps.clients, deps.encryptor) : new ArtifactAdapter(name, deps.oidcArtifacts);
}
