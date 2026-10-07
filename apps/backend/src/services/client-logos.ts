import type { OidcClientRecord, UserRecord } from "@aegis/db";
import type { Database } from "../db/database.js";
import { notFound } from "../lib/errors.js";
import { normalizeSquareImage } from "../lib/images.js";
import type { AuditLog } from "../repositories/audit.js";
import type { ClientLogoRepository } from "../repositories/client-logos.js";
import type { ClientRepository } from "../repositories/clients.js";
import type { RequestMeta } from "./auth.js";
import { clientReference } from "./clients.js";
import { accountReference } from "./users.js";

/** Application logos, handled exactly like profile pictures (see `AvatarService`). */
export class ClientLogoService {
	private readonly deps: { database: Database; clients: ClientRepository; logos: ClientLogoRepository; audit: AuditLog };

	public constructor(deps: ClientLogoService["deps"]) {
		this.deps = deps;
	}

	public async set(clientId: string, upload: Buffer, actor: UserRecord, meta: RequestMeta): Promise<OidcClientRecord> {
		const { database, clients, logos, audit } = this.deps;
		const { image, hash } = await normalizeSquareImage(upload);

		return database.transaction(async () => {
			const now = new Date();
			const updated = await clients.update(clientId, { logoHash: hash }, now);
			if (!updated) {
				throw notFound("Application");
			}
			await logos.save(clientId, hash, image, now);
			await audit.record({
				type: "client.logo_updated",
				actor: accountReference(actor),
				client: clientReference(updated),
				meta,
			});
			return updated;
		});
	}

	public async remove(clientId: string, actor: UserRecord, meta: RequestMeta): Promise<OidcClientRecord> {
		const { database, clients, logos, audit } = this.deps;

		return database.transaction(async () => {
			const existing = await clients.findById(clientId);
			if (!existing) {
				throw notFound("Application");
			}
			if (!existing.logoHash) {
				return existing;
			}
			await logos.delete(clientId);
			const updated = await clients.update(clientId, { logoHash: null }, new Date());
			if (!updated) {
				throw notFound("Application");
			}
			await audit.record({
				type: "client.logo_removed",
				actor: accountReference(actor),
				client: clientReference(updated),
				meta,
			});
			return updated;
		});
	}
}
