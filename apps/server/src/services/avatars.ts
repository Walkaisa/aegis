import type { UserRecord } from "@aegis/db";
import type { Database } from "../db/database.js";
import { notFound } from "../lib/errors.js";
import { normalizeSquareImage } from "../lib/images.js";
import type { AuditLog } from "../repositories/audit.js";
import type { AvatarRepository } from "../repositories/avatars.js";
import type { UserRepository } from "../repositories/users.js";
import type { RequestMeta } from "./auth.js";
import { accountReference } from "./users.js";

/** Profile pictures. Uploads are normalized first (see `normalizeSquareImage`). */
export class AvatarService {
	private readonly deps: { database: Database; users: UserRepository; avatars: AvatarRepository; audit: AuditLog };

	public constructor(deps: AvatarService["deps"]) {
		this.deps = deps;
	}

	public async set(userId: string, upload: Buffer, actor: UserRecord, meta: RequestMeta): Promise<UserRecord> {
		const { database, users, avatars, audit } = this.deps;
		const { image, hash } = await normalizeSquareImage(upload);

		return database.transaction(async () => {
			const now = new Date();
			const updated = await users.update(userId, { avatarHash: hash }, now);
			if (!updated) {
				throw notFound("Account");
			}
			await avatars.save(userId, hash, image, now);
			await audit.record({
				type: "user.avatar_updated",
				actor: accountReference(actor),
				subject: accountReference(updated),
				meta,
			});
			return updated;
		});
	}

	public async remove(userId: string, actor: UserRecord, meta: RequestMeta): Promise<UserRecord> {
		const { database, users, avatars, audit } = this.deps;

		return database.transaction(async () => {
			const existing = await users.findById(userId);
			if (!existing) {
				throw notFound("Account");
			}
			if (!existing.avatarHash) {
				return existing;
			}
			await avatars.delete(userId);
			const updated = await users.update(userId, { avatarHash: null }, new Date());
			if (!updated) {
				throw notFound("Account");
			}
			await audit.record({
				type: "user.avatar_removed",
				actor: accountReference(actor),
				subject: accountReference(updated),
				meta,
			});
			return updated;
		});
	}
}
