import { userAvatars } from "@aegis/db";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/database.js";

/** Stored profile pictures, one per account. */
export class AvatarRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	/** The image only matches when the hash is the current one; old URLs stop resolving. */
	public async findImage(userId: string, hash: string): Promise<Buffer | null> {
		const [row] = await this.database.db
			.select({ image: userAvatars.image })
			.from(userAvatars)
			.where(and(eq(userAvatars.userId, userId), eq(userAvatars.hash, hash)))
			.limit(1);
		return row?.image ?? null;
	}

	public async save(userId: string, hash: string, image: Buffer, at: Date): Promise<void> {
		await this.database.db
			.insert(userAvatars)
			.values({ userId, hash, image, createdAt: at })
			.onConflictDoUpdate({ target: userAvatars.userId, set: { hash, image, createdAt: at } });
	}

	public async delete(userId: string): Promise<boolean> {
		const result = await this.database.db.delete(userAvatars).where(eq(userAvatars.userId, userId));
		return (result.rowCount ?? 0) > 0;
	}
}
