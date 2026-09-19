import { normalizeEmail, type SetupRequest } from "@aegis/contracts";
import { isUniqueViolation, type SessionRecord, type UserRecord } from "@aegis/db";
import type { FastifyBaseLogger } from "fastify";
import type { PasswordHasher } from "../crypto/passwords.js";
import type { Database } from "../db/database.js";
import { ApiError } from "../lib/errors.js";
import { newId } from "../lib/snowflakes.js";
import type { OidcRuntime } from "../oidc/runtime.js";
import type { AuditLog } from "../repositories/audit.js";
import type { KeyRepository } from "../repositories/keys.js";
import type { SettingsRepository } from "../repositories/settings.js";
import type { UserRepository } from "../repositories/users.js";
import type { AuthService, RequestMeta } from "./auth.js";
import type { KeyService } from "./keys.js";
import { DEFAULT_SESSION_TTL_SECONDS } from "./session-policy.js";
import { accountReference } from "./users.js";

export interface SetupServiceDependencies {
	database: Database;
	settings: SettingsRepository;
	users: UserRepository;
	keys: KeyRepository;
	keyService: KeyService;
	passwords: PasswordHasher;
	audit: AuditLog;
	auth: AuthService;
	oidc: OidcRuntime;
	log: FastifyBaseLogger;
	/** Seed value for the instance-wide audit retention, from `AEGIS_AUDIT_RETENTION_DAYS`. */
	auditRetentionDays: number;
}

const setupCompleted = () => new ApiError(409, "setup_completed", "Setup has already been completed");

/**
 * One-time bootstrap: creates the initial admin account, the signing key, the cookie keys and the
 * instance settings in a single transaction. The settings row closes the setup for good.
 */
export class SetupService {
	private readonly deps: SetupServiceDependencies;

	public constructor(deps: SetupServiceDependencies) {
		this.deps = deps;
	}

	public async complete(input: SetupRequest, meta: RequestMeta): Promise<{ user: UserRecord; token: string; session: SessionRecord }> {
		const { database, settings, users, keys, keyService, passwords, audit, auth, oidc, log } = this.deps;

		if (settings.isSetupComplete()) {
			throw setupCompleted();
		}

		const now = new Date();
		const [passwordHash, signingKey] = await Promise.all([passwords.hash(input.password), keyService.createSigningKey(now)]);

		let user: UserRecord;
		try {
			user = await database.transaction(async () => {
				const admin = await users.insert({
					id: newId(),
					email: input.email,
					emailNormalized: normalizeEmail(input.email),
					displayName: input.displayName,
					passwordHash,
					role: "admin",
					enabled: true,
					emailVerified: true,
					passwordChangedAt: now,
					lastSignInAt: now,
					createdAt: now,
					updatedAt: now,
				});
				await keys.insertSigningKey(signingKey);
				await keys.insertCookieKey(keyService.createCookieKey(now));
				await settings.insert({
					instanceName: input.instanceName,
					sessionTtlSeconds: DEFAULT_SESSION_TTL_SECONDS,
					auditRetentionDays: this.deps.auditRetentionDays,
					encryptionKeyCheck: keyService.createKeyCheck(),
					setupCompletedAt: now,
					updatedAt: now,
				});
				return admin;
			});
		} catch (error) {
			// The settings table allows a single row; a concurrent setup loses here.
			if (isUniqueViolation(error)) {
				throw setupCompleted();
			}
			throw error;
		}

		await settings.refresh();
		await oidc.reload();
		await audit.record(
			{
				type: "setup.completed",
				actor: accountReference(user),
				subject: accountReference(user),
				meta,
				metadata: { instanceName: input.instanceName },
			},
			now,
		);
		log.info("Initial setup completed");

		const { token, session } = await auth.createSession(user, meta, { authenticatedAt: now });
		return { user, token, session };
	}
}
