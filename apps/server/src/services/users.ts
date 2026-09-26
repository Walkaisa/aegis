import {
	type Locale,
	normalizeEmail,
	type PasswordChangeRequest,
	type PasswordResetRequest,
	type ProfileUpdateRequest,
	type UserCreateRequest,
	type UserUpdateRequest,
} from "@aegis/contracts";
import { isUniqueViolation, type UserRecord } from "@aegis/db";
import type { PasswordHasher } from "../crypto/passwords.js";
import { randomToken } from "../crypto/tokens.js";
import type { Database } from "../db/database.js";
import { ApiError, notFound } from "../lib/errors.js";
import { newId } from "../lib/snowflakes.js";
import type { AuditLog } from "../repositories/audit.js";
import type { UserRepository } from "../repositories/users.js";
import type { AccountRecoveryService } from "./account-recovery.js";
import type { RequestMeta } from "./auth.js";
import type { AccessRevoker } from "./revocation.js";

/** 18 random bytes, i.e. a 24-character base64url password. */
const GENERATED_PASSWORD_BYTES = 18;

const emailTaken = () => new ApiError(409, "email_taken", "An account with this e-mail address already exists");
const lastActiveAdmin = () => new ApiError(409, "last_active_admin", "At least one enabled admin account must remain");
const invalidCurrentPassword = () => new ApiError(400, "invalid_current_password", "The current password is incorrect");

/** Audit reference of an account. The e-mail address keeps history readable after a deletion. */
export function accountReference(user: Pick<UserRecord, "id" | "email">) {
	return { id: user.id, label: user.email };
}

export interface UserServiceDependencies {
	database: Database;
	users: UserRepository;
	passwords: PasswordHasher;
	revoker: AccessRevoker;
	audit: AuditLog;
	recovery: AccountRecoveryService;
}

/**
 * Account management. Every change that could leave Aegis without an enabled admin runs in a
 * transaction that locks the enabled admin rows first.
 */
export class UserService {
	private readonly deps: UserServiceDependencies;

	public constructor(deps: UserServiceDependencies) {
		this.deps = deps;
	}

	public async create(input: UserCreateRequest, actor: UserRecord, meta: RequestMeta): Promise<UserRecord> {
		const { users, passwords, audit } = this.deps;
		const now = new Date();
		const passwordHash = await passwords.hash(input.password);

		let user: UserRecord;
		try {
			user = await users.insert({
				id: newId(),
				email: input.email,
				emailNormalized: normalizeEmail(input.email),
				displayName: input.displayName,
				passwordHash,
				role: input.role,
				enabled: input.enabled,
				emailVerified: input.emailVerified,
				passwordChangedAt: now,
				createdAt: now,
				updatedAt: now,
			});
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw emailTaken();
			}
			throw error;
		}

		await audit.record({
			type: "user.created",
			actor: accountReference(actor),
			subject: accountReference(user),
			meta,
			metadata: { role: user.role, enabled: user.enabled },
		});
		return user;
	}

	public update(id: string, input: UserUpdateRequest, actor: UserRecord, meta: RequestMeta): Promise<UserRecord> {
		const { database, revoker, audit, recovery } = this.deps;

		return database.transaction(async () => {
			const existing = await this.find(id);
			const roleChanged = existing.role !== input.role;

			if (roleChanged && existing.role === "admin" && existing.enabled) {
				await this.assertAnotherActiveAdmin(existing.id);
			}

			const emailNormalized = normalizeEmail(input.email);
			const emailChanged = emailNormalized !== existing.emailNormalized;
			const updated = await this.save(
				id,
				{
					email: input.email,
					emailNormalized,
					displayName: input.displayName,
					role: input.role,
					emailVerified: input.emailVerified,
				},
				new Date(),
			);
			if (emailChanged) {
				await recovery.revokeLinks(id);
			}

			await audit.record({
				type: "user.updated",
				actor: accountReference(actor),
				subject: accountReference(updated),
				meta,
				metadata: { emailChanged },
			});

			if (roleChanged) {
				// Sessions and grants were issued under the previous role and must not carry over.
				await revoker.revokeUser(id);
				await audit.record({
					type: "user.role_changed",
					actor: accountReference(actor),
					subject: accountReference(updated),
					meta,
					metadata: { from: existing.role, to: updated.role },
				});
			}

			return updated;
		});
	}

	public setEnabled(id: string, enabled: boolean, actor: UserRecord, meta: RequestMeta): Promise<UserRecord> {
		const { database, revoker, audit, recovery } = this.deps;

		return database.transaction(async () => {
			const existing = await this.find(id);
			if (existing.enabled === enabled) {
				return existing;
			}
			if (!enabled && existing.role === "admin") {
				await this.assertAnotherActiveAdmin(existing.id);
			}

			const updated = await this.save(id, { enabled }, new Date());
			if (!enabled) {
				await revoker.revokeUser(id);
				await recovery.revokeLinks(id);
			}

			await audit.record({
				type: enabled ? "user.enabled" : "user.disabled",
				actor: accountReference(actor),
				subject: accountReference(updated),
				meta,
			});
			return updated;
		});
	}

	public async resetPassword(
		id: string,
		input: PasswordResetRequest,
		actor: UserRecord,
		meta: RequestMeta,
	): Promise<{ user: UserRecord; generatedPassword: string | null }> {
		const { database, passwords, revoker, audit, recovery } = this.deps;
		await this.find(id);

		const generatedPassword = input.mode === "generate" ? randomToken(GENERATED_PASSWORD_BYTES) : null;
		const passwordHash = await passwords.hash(generatedPassword ?? (input.mode === "manual" ? input.password : ""));

		const user = await database.transaction(async () => {
			const now = new Date();
			const updated = await this.save(id, { passwordHash, passwordChangedAt: now }, now);
			await revoker.revokeUser(id);
			await recovery.revokeLinks(id);
			await audit.record({
				type: "user.password_reset",
				actor: accountReference(actor),
				subject: accountReference(updated),
				meta,
				metadata: { generated: generatedPassword !== null },
			});
			return updated;
		});

		return { user, generatedPassword };
	}

	/** Ends all sessions of the account and invalidates its grants and tokens. */
	public async revokeSessions(id: string, actor: UserRecord, meta: RequestMeta): Promise<number> {
		const { revoker, audit } = this.deps;
		const user = await this.find(id);
		const revoked = await revoker.revokeUser(id);

		await audit.record({
			type: "session.revoked",
			actor: accountReference(actor),
			subject: accountReference(user),
			meta,
			metadata: { sessions: revoked },
		});
		return revoked;
	}

	public delete(id: string, actor: UserRecord, meta: RequestMeta): Promise<void> {
		const { database, users, revoker, audit } = this.deps;

		return database.transaction(async () => {
			const existing = await this.find(id);
			if (existing.role === "admin" && existing.enabled) {
				await this.assertAnotherActiveAdmin(existing.id);
			}

			// Recorded first: the reference to the account is set to NULL once it is gone.
			await audit.record({
				type: "user.deleted",
				actor: accountReference(actor),
				subject: accountReference(existing),
				meta,
				metadata: { role: existing.role },
			});
			// Provider artifacts have no foreign key to the account; sessions and consents cascade.
			await revoker.revokeUser(id);
			await users.delete(id);
		});
	}

	/**
	 * Profile changes of the signed-in account; a new e-mail address requires the password. While
	 * Aegis can send e-mail, a new address only takes effect once it is confirmed from its mailbox.
	 */
	public async updateOwnProfile(user: UserRecord, input: ProfileUpdateRequest, locale: Locale, meta: RequestMeta): Promise<UserRecord> {
		const { passwords, audit, recovery } = this.deps;
		const emailNormalized = normalizeEmail(input.email);
		const emailChanged = emailNormalized !== user.emailNormalized;

		if (emailChanged) {
			const confirmed = input.currentPassword !== undefined && (await passwords.verify(user.passwordHash, input.currentPassword));
			if (!confirmed) {
				throw invalidCurrentPassword();
			}
		}

		const confirmEmail = emailChanged && recovery.confirmsEmailChanges();
		if (confirmEmail) {
			await recovery.startEmailChange({ ...user, displayName: input.displayName }, input.email, locale, meta);
		}
		if (input.displayName === user.displayName && (confirmEmail || input.email === user.email)) {
			return user;
		}

		const updated = await this.save(
			user.id,
			confirmEmail ? { displayName: input.displayName } : { email: input.email, emailNormalized, displayName: input.displayName },
			new Date(),
		);
		if (emailChanged && !confirmEmail) {
			await recovery.revokeLinks(user.id);
		}
		await audit.record({
			type: "user.updated",
			actor: accountReference(updated),
			subject: accountReference(updated),
			meta,
			metadata: { emailChanged: emailChanged && !confirmEmail },
		});
		return updated;
	}

	/**
	 * Changes the password of the signed-in account, ends all of its other sessions and invalidates
	 * the links still on their way to it.
	 */
	public async changeOwnPassword(
		user: UserRecord,
		currentSessionId: string,
		input: PasswordChangeRequest,
		locale: Locale,
		meta: RequestMeta,
	): Promise<void> {
		const { database, passwords, revoker, audit, recovery } = this.deps;
		if (!(await passwords.verify(user.passwordHash, input.currentPassword))) {
			throw invalidCurrentPassword();
		}

		const passwordHash = await passwords.hash(input.newPassword);
		const now = new Date();
		await database.transaction(async () => {
			await this.save(user.id, { passwordHash, passwordChangedAt: now }, now);
			await revoker.revokeUser(user.id, { keepSessionId: currentSessionId });
			await recovery.revokeLinks(user.id);
			await audit.record({
				type: "user.password_changed",
				actor: accountReference(user),
				subject: accountReference(user),
				meta,
			});
		});
		await recovery.notifyPasswordChanged(user, now, locale, meta, accountReference(user));
	}

	private async find(id: string): Promise<UserRecord> {
		const user = await this.deps.users.findById(id);
		if (!user) {
			throw notFound("Account");
		}
		return user;
	}

	private async save(id: string, changes: Parameters<UserRepository["update"]>[1], at: Date): Promise<UserRecord> {
		try {
			const updated = await this.deps.users.update(id, changes, at);
			if (!updated) {
				throw notFound("Account");
			}
			return updated;
		} catch (error) {
			if (isUniqueViolation(error)) {
				throw emailTaken();
			}
			throw error;
		}
	}

	private async assertAnotherActiveAdmin(excludedId: string): Promise<void> {
		const activeAdminIds = await this.deps.users.lockActiveAdminIds();
		if (!activeAdminIds.some((id) => id !== excludedId)) {
			throw lastActiveAdmin();
		}
	}
}
