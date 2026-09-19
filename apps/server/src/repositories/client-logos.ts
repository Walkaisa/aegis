import { clientLogos } from "@aegis/db";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/database.js";

/** Stored application logos, one per application. */
export class ClientLogoRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	/** The image only matches when the hash is the current one; old URLs stop resolving. */
	public async findImage(clientId: string, hash: string): Promise<Buffer | null> {
		const [row] = await this.database.db
			.select({ image: clientLogos.image })
			.from(clientLogos)
			.where(and(eq(clientLogos.clientId, clientId), eq(clientLogos.hash, hash)))
			.limit(1);
		return row?.image ?? null;
	}

	public async save(clientId: string, hash: string, image: Buffer, at: Date): Promise<void> {
		await this.database.db
			.insert(clientLogos)
			.values({ clientId, hash, image, createdAt: at })
			.onConflictDoUpdate({ target: clientLogos.clientId, set: { hash, image, createdAt: at } });
	}

	public async delete(clientId: string): Promise<boolean> {
		const result = await this.database.db.delete(clientLogos).where(eq(clientLogos.clientId, clientId));
		return (result.rowCount ?? 0) > 0;
	}
}
