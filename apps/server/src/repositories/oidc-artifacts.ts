import { oidcArtifacts } from "@aegis/db";
import { and, eq, gt, inArray, isNotNull, isNull, lte, notInArray, or, type SQL } from "drizzle-orm";
import type { Database } from "../db/database.js";

export type OidcPayload = Record<string, unknown>;

export interface StoredArtifact {
	payload: OidcPayload;
	consumedAt: Date | null;
}

/** Models that represent a signed-in state or credentials issued to an account. */
const ACCOUNT_MODELS = [
	"Session",
	"Grant",
	"AuthorizationCode",
	"AccessToken",
	"RefreshToken",
	"DeviceCode",
	"BackchannelAuthenticationRequest",
];

function stringOrNull(value: unknown): string | null {
	return typeof value === "string" && value.length > 0 ? value : null;
}

/** Persistence for oidc-provider models (sessions, interactions, grants, codes and tokens). */
export class OidcArtifactRepository {
	private readonly database: Database;

	public constructor(database: Database) {
		this.database = database;
	}

	public async upsert(model: string, id: string, payload: OidcPayload, expiresAt: Date | null): Promise<void> {
		const lookup = {
			grantId: stringOrNull(payload.grantId),
			userCode: stringOrNull(payload.userCode),
			uid: stringOrNull(payload.uid),
			clientId: stringOrNull(payload.clientId),
			accountId: stringOrNull(payload.accountId),
		};

		await this.database.db
			.insert(oidcArtifacts)
			.values({ model, id, payload, expiresAt, ...lookup })
			.onConflictDoUpdate({
				target: [oidcArtifacts.model, oidcArtifacts.id],
				set: { payload, expiresAt, ...lookup },
			});
	}

	public find(model: string, id: string, now: Date): Promise<StoredArtifact | null> {
		return this.findBy(model, eq(oidcArtifacts.id, id), now);
	}

	public findByUid(model: string, uid: string, now: Date): Promise<StoredArtifact | null> {
		return this.findBy(model, eq(oidcArtifacts.uid, uid), now);
	}

	public findByUserCode(model: string, userCode: string, now: Date): Promise<StoredArtifact | null> {
		return this.findBy(model, eq(oidcArtifacts.userCode, userCode), now);
	}

	public async consume(model: string, id: string, at: Date): Promise<void> {
		await this.database.db
			.update(oidcArtifacts)
			.set({ consumedAt: at })
			.where(and(eq(oidcArtifacts.model, model), eq(oidcArtifacts.id, id)));
	}

	public async destroy(model: string, id: string): Promise<void> {
		await this.database.db.delete(oidcArtifacts).where(and(eq(oidcArtifacts.model, model), eq(oidcArtifacts.id, id)));
	}

	public async revokeByGrantId(model: string, grantId: string): Promise<void> {
		await this.database.db.delete(oidcArtifacts).where(and(eq(oidcArtifacts.model, model), eq(oidcArtifacts.grantId, grantId)));
	}

	/** Ends single sign-on and invalidates all grants, codes and tokens of an account. */
	public async deleteByAccount(accountId: string): Promise<number> {
		const result = await this.database.db
			.delete(oidcArtifacts)
			.where(and(eq(oidcArtifacts.accountId, accountId), inArray(oidcArtifacts.model, ACCOUNT_MODELS)));
		return result.rowCount ?? 0;
	}

	/** Ends single sign-on and invalidates all grants, codes and tokens of every account. */
	public async deleteAllAccounts(): Promise<number> {
		const result = await this.database.db.delete(oidcArtifacts).where(inArray(oidcArtifacts.model, ACCOUNT_MODELS));
		return result.rowCount ?? 0;
	}

	/** Invalidates everything issued to an application (public `client_id`). */
	public async deleteByClient(clientId: string): Promise<number> {
		const result = await this.database.db.delete(oidcArtifacts).where(eq(oidcArtifacts.clientId, clientId));
		return result.rowCount ?? 0;
	}

	/** Invalidates the grants, codes and tokens one account holds for one application. */
	public async deleteByClientAndAccount(clientId: string, accountId: string): Promise<number> {
		const result = await this.database.db
			.delete(oidcArtifacts)
			.where(and(eq(oidcArtifacts.clientId, clientId), eq(oidcArtifacts.accountId, accountId)));
		return result.rowCount ?? 0;
	}

	/** Invalidates everything an application issued to accounts other than the given ones. */
	public async deleteByClientExceptAccounts(clientId: string, keepAccountIds: readonly string[]): Promise<number> {
		const result = await this.database.db
			.delete(oidcArtifacts)
			.where(
				and(
					eq(oidcArtifacts.clientId, clientId),
					isNotNull(oidcArtifacts.accountId),
					notInArray(oidcArtifacts.accountId, [...keepAccountIds]),
				),
			);
		return result.rowCount ?? 0;
	}

	public async deleteExpired(now: Date): Promise<number> {
		const result = await this.database.db.delete(oidcArtifacts).where(lte(oidcArtifacts.expiresAt, now));
		return result.rowCount ?? 0;
	}

	private async findBy(model: string, condition: SQL, now: Date): Promise<StoredArtifact | null> {
		const [row] = await this.database.db
			.select({ payload: oidcArtifacts.payload, consumedAt: oidcArtifacts.consumedAt })
			.from(oidcArtifacts)
			.where(and(eq(oidcArtifacts.model, model), condition, or(isNull(oidcArtifacts.expiresAt), gt(oidcArtifacts.expiresAt, now))))
			.limit(1);
		return row ?? null;
	}
}
