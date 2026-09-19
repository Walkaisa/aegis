import {
	type RecoveryCodesResponse,
	type SecondFactorMethod,
	TOTP_DIGITS,
	TOTP_PERIOD_SECONDS,
	type TwoFactorSetupResponse,
	type TwoFactorStatusDto,
} from "@aegis/contracts";
import type { UserRecord } from "@aegis/db";
import type { Encryptor } from "../crypto/encryption.js";
import { generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, isTotpCode, matchTotp, totpUri } from "../crypto/one-time-codes.js";
import type { PasswordHasher } from "../crypto/passwords.js";
import type { Database } from "../db/database.js";
import { ApiError, forbidden, notFound } from "../lib/errors.js";
import { toIsoOrNull } from "../lib/time.js";
import type { AuditLog } from "../repositories/audit.js";
import type { RecoveryCodeRepository } from "../repositories/recovery-codes.js";
import type { SettingsRepository } from "../repositories/settings.js";
import type { UserRepository } from "../repositories/users.js";
import type { RequestMeta } from "./auth.js";
import type { AccessRevoker } from "./revocation.js";
import { accountReference } from "./users.js";

const invalidCurrentPassword = () => new ApiError(400, "invalid_current_password", "The current password is incorrect");
const invalidCode = () => new ApiError(400, "second_factor_invalid", "The code is invalid or has already been used");
const alreadyEnabled = () => new ApiError(409, "two_factor_already_enabled", "Two-factor authentication is already enabled");
const notEnabled = () => new ApiError(409, "two_factor_not_enabled", "Two-factor authentication is not enabled");

export interface TwoFactorServiceDependencies {
	database: Database;
	users: UserRepository;
	recoveryCodes: RecoveryCodeRepository;
	passwords: PasswordHasher;
	encryptor: Encryptor;
	settings: SettingsRepository;
	revoker: AccessRevoker;
	audit: AuditLog;
}

export function isTwoFactorEnabled(user: Pick<UserRecord, "totpEnabledAt" | "totpSecret">): boolean {
	return user.totpEnabledAt !== null && user.totpSecret !== null;
}

/** The secret is bound to its account, so a ciphertext copied to another row does not decrypt. */
const secretContext = (userId: string) => `users.totp_secret:${userId}`;

/**
 * Two-factor authentication of an account: the setup with an authenticator app, recovery codes and
 * the verification of codes during sign-in.
 */
export class TwoFactorService {
	private readonly deps: TwoFactorServiceDependencies;

	public constructor(deps: TwoFactorServiceDependencies) {
		this.deps = deps;
	}

	public async status(user: UserRecord): Promise<TwoFactorStatusDto> {
		const enabled = isTwoFactorEnabled(user);
		return {
			enabled,
			enabledAt: enabled ? toIsoOrNull(user.totpEnabledAt) : null,
			label: enabled ? user.totpLabel : null,
			recoveryCodesRemaining: enabled ? await this.deps.recoveryCodes.countUnused(user.id) : 0,
		};
	}

	/** Creates a new secret for the authenticator app. It only takes effect once `enable` confirms a code. */
	public async beginSetup(user: UserRecord, currentPassword: string): Promise<TwoFactorSetupResponse> {
		const { users, encryptor, settings } = this.deps;
		await this.confirmPassword(user, currentPassword);
		if (isTwoFactorEnabled(user)) {
			throw alreadyEnabled();
		}

		const secret = generateTotpSecret();
		await users.update(
			user.id,
			{ totpSecret: encryptor.encrypt(secret, secretContext(user.id)), totpEnabledAt: null, totpLastCounter: null },
			new Date(),
		);

		const issuer = settings.get()?.instanceName ?? "Aegis";
		return {
			secret,
			otpauthUri: totpUri(secret, issuer, user.email),
			issuer,
			accountName: user.email,
			digits: TOTP_DIGITS,
			period: TOTP_PERIOD_SECONDS,
		};
	}

	/**
	 * Confirms the setup with a first code, issues the recovery codes and ends the other sessions of the
	 * account, which were started without a second factor.
	 */
	public async enable(
		user: UserRecord,
		code: string,
		label: string | null,
		currentSessionId: string,
		meta: RequestMeta,
	): Promise<RecoveryCodesResponse> {
		const { database, users, revoker, audit } = this.deps;
		const current = await this.fresh(user.id);
		if (isTwoFactorEnabled(current)) {
			throw alreadyEnabled();
		}
		if (current.totpSecret === null) {
			throw new ApiError(409, "two_factor_setup_required", "Start the setup before confirming a code");
		}
		if (!(await this.acceptTotp(current, code))) {
			throw invalidCode();
		}

		const codes = generateRecoveryCodes();
		const updated = await database.transaction(async () => {
			const now = new Date();
			const saved = await users.update(current.id, { totpEnabledAt: now, totpLabel: label }, now);
			if (!saved) {
				throw notFound("Account");
			}
			await this.deps.recoveryCodes.replace(current.id, codes.map(hashRecoveryCode), now);
			await revoker.revokeUser(current.id, { keepSessionId: currentSessionId });
			await audit.record({ type: "user.two_factor_enabled", actor: accountReference(saved), subject: accountReference(saved), meta });
			return saved;
		});

		return { codes, twoFactor: await this.status(updated) };
	}

	/** Discards a setup that was started but never confirmed. */
	public async cancelSetup(user: UserRecord): Promise<void> {
		const current = await this.fresh(user.id);
		if (!isTwoFactorEnabled(current) && current.totpSecret !== null) {
			await this.deps.users.update(current.id, { totpSecret: null, totpLastCounter: null }, new Date());
		}
	}

	/** Turns two-factor authentication off; a recovery code works in place of the authenticator. */
	public async disable(user: UserRecord, currentPassword: string, code: string, meta: RequestMeta): Promise<TwoFactorStatusDto> {
		await this.confirmPassword(user, currentPassword);
		const current = await this.fresh(user.id);
		if (!isTwoFactorEnabled(current)) {
			throw notEnabled();
		}
		if (!(await this.verify(current, code))) {
			throw invalidCode();
		}

		const updated = await this.clear(current);
		await this.deps.audit.record({
			type: "user.two_factor_disabled",
			actor: accountReference(current),
			subject: accountReference(current),
			meta,
		});
		return this.status(updated);
	}

	/** Replaces all recovery codes; the previous ones stop working. */
	public async regenerateRecoveryCodes(
		user: UserRecord,
		currentPassword: string,
		code: string,
		meta: RequestMeta,
	): Promise<RecoveryCodesResponse> {
		await this.confirmPassword(user, currentPassword);
		const current = await this.fresh(user.id);
		if (!isTwoFactorEnabled(current)) {
			throw notEnabled();
		}
		if (!(await this.verify(current, code))) {
			throw invalidCode();
		}

		const codes = generateRecoveryCodes();
		await this.deps.recoveryCodes.replace(current.id, codes.map(hashRecoveryCode), new Date());
		await this.deps.audit.record({
			type: "user.recovery_codes_regenerated",
			actor: accountReference(current),
			subject: accountReference(current),
			meta,
		});
		return { codes, twoFactor: await this.status(current) };
	}

	/**
	 * An admin turns two-factor authentication off for another account, e.g. after its owner lost the
	 * device and the recovery codes. The own account requires password and code in the account settings.
	 */
	public async reset(userId: string, actor: UserRecord, meta: RequestMeta): Promise<void> {
		if (userId === actor.id) {
			throw forbidden();
		}
		const current = await this.fresh(userId);
		if (!isTwoFactorEnabled(current) && current.totpSecret === null) {
			return;
		}

		await this.clear(current);
		await this.deps.audit.record({
			type: "user.two_factor_reset",
			actor: accountReference(actor),
			subject: accountReference(current),
			meta,
		});
	}

	/**
	 * Verifies the second factor of a sign-in: a code from the authenticator app or an unused recovery
	 * code. Every accepted code is spent. Returns how it was confirmed, or `null`.
	 */
	public async verify(user: UserRecord, code: string): Promise<SecondFactorMethod | null> {
		if (!isTwoFactorEnabled(user)) {
			return null;
		}
		if (isTotpCode(code)) {
			return (await this.acceptTotp(user, code)) ? "totp" : null;
		}
		return (await this.deps.recoveryCodes.consume(user.id, hashRecoveryCode(code), new Date())) ? "recovery_code" : null;
	}

	private async acceptTotp(user: UserRecord, code: string): Promise<boolean> {
		if (user.totpSecret === null) {
			return false;
		}
		const secret = this.deps.encryptor.decryptString(user.totpSecret, secretContext(user.id));
		const counter = matchTotp(secret, code);
		return counter !== null && (await this.deps.users.claimTotpCounter(user.id, counter));
	}

	private clear(user: UserRecord): Promise<UserRecord> {
		const { database, users, recoveryCodes } = this.deps;
		return database.transaction(async () => {
			const now = new Date();
			const updated = await users.update(
				user.id,
				{ totpSecret: null, totpEnabledAt: null, totpLabel: null, totpLastCounter: null },
				now,
			);
			if (!updated) {
				throw notFound("Account");
			}
			await recoveryCodes.deleteByUser(user.id);
			return updated;
		});
	}

	private async confirmPassword(user: UserRecord, currentPassword: string): Promise<void> {
		if (!(await this.deps.passwords.verify(user.passwordHash, currentPassword))) {
			throw invalidCurrentPassword();
		}
	}

	/** The request's account may be outdated by a concurrent change; two-factor state is always read anew. */
	private async fresh(userId: string): Promise<UserRecord> {
		const user = await this.deps.users.findById(userId);
		if (!user) {
			throw notFound("Account");
		}
		return user;
	}
}
