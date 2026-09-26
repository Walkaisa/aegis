import { type Locale, normalizeEmail, type PasswordResetTokenDto, type PendingEmailChangeDto } from "@aegis/contracts";
import { type AccountTokenPurpose, type AccountTokenRecord, isUniqueViolation, type UserRecord } from "@aegis/db";
import type { PasswordHasher } from "../crypto/passwords.js";
import { randomToken, sha256 } from "../crypto/tokens.js";
import type { Database } from "../db/database.js";
import { ApiError, notFound } from "../lib/errors.js";
import { newId } from "../lib/snowflakes.js";
import { DAY_MS, HOUR_MS, MINUTE_MS, toIso } from "../lib/time.js";
import type { AccountTokenRepository, AccountTokenWithUser } from "../repositories/account-tokens.js";
import type { AuditLog, AuditReference } from "../repositories/audit.js";
import type { UserRepository } from "../repositories/users.js";
import type { RequestMeta } from "./auth.js";
import type { EmailService } from "./email.js";
import type { AccessRevoker } from "./revocation.js";
import { accountReference } from "./users.js";

/**
 * A reset link is a password in its own right, so it lives about as long as one sitting in an
 * inbox should. Confirming an address is not a credential and may wait for the next working day.
 */
export const PASSWORD_RESET_TTL_MS = HOUR_MS;
export const EMAIL_CHANGE_TTL_MS = DAY_MS;

/** A second reset link within this window is not sent, to keep inboxes calm. */
const RESEND_COOLDOWN_MS = 2 * MINUTE_MS;

/** 32 random bytes, i.e. a 43-character base64url token. */
const TOKEN_BYTES = 32;

const invalidToken = () => new ApiError(400, "verification_token_invalid", "This link is no longer valid. Request a new one.");
const emailTaken = () => new ApiError(409, "email_taken", "An account with this e-mail address already exists");
const changePending = () => new ApiError(409, "email_change_pending", "A change to this address is already waiting to be confirmed");

/** Why a link could not be redeemed, as recorded in the audit log; the caller always sees `invalidToken`. */
type LinkFailure = "invalid_token" | "expired" | "already_used" | "account_disabled";

function linkFailureOf(found: AccountTokenWithUser | null, now: Date): LinkFailure | null {
	if (!found) {
		return "invalid_token";
	}
	if (found.token.consumedAt !== null) {
		return "already_used";
	}
	if (found.token.expiresAt <= now) {
		return "expired";
	}
	return found.user.enabled ? null : "account_disabled";
}

/** Hides most of the local part of an address: `alex@example.com` becomes `al••@example.com`. */
function maskEmail(email: string): string {
	const at = email.lastIndexOf("@");
	const local = email.slice(0, at);
	const visible = local.length <= 2 ? 1 : 2;
	return `${local.slice(0, visible)}${"•".repeat(Math.max(local.length - visible, 2))}${email.slice(at)}`;
}

function toPendingDto(record: AccountTokenRecord): PendingEmailChangeDto {
	return {
		email: record.targetEmail ?? "",
		requestedAt: toIso(record.createdAt),
		expiresAt: toIso(record.expiresAt),
	};
}

export interface AccountRecoveryDependencies {
	database: Database;
	users: UserRepository;
	tokens: AccountTokenRepository;
	passwords: PasswordHasher;
	revoker: AccessRevoker;
	audit: AuditLog;
	email: EmailService;
	/** Public origin the links point at. */
	issuer: string;
}

/**
 * The two flows that run over e-mail: resetting a forgotten password and confirming a new address.
 *
 * Both hand out a single-use link whose token is stored as a hash only, both invalidate whatever
 * link was outstanding before, and both leave a trail in the audit log — including the attempts
 * that went nowhere, since a stream of resets for unknown addresses is worth seeing.
 */
export class AccountRecoveryService {
	private readonly deps: AccountRecoveryDependencies;

	public constructor(deps: AccountRecoveryDependencies) {
		this.deps = deps;
	}

	/** Whether a new e-mail address is confirmed from its mailbox before it takes effect. */
	public confirmsEmailChanges(): boolean {
		return this.deps.email.isEnabled();
	}

	/**
	 * Sends a reset link, if the address belongs to an account that may sign in. The caller learns
	 * nothing either way, so the endpoint cannot be used to find out who has an account here.
	 */
	public async requestPasswordReset(email: string, locale: Locale, meta: RequestMeta): Promise<void> {
		const { users, tokens, audit, email: mail } = this.deps;
		const emailNormalized = normalizeEmail(email);
		const user = await users.findByEmail(emailNormalized);

		const record = (reason: string | null, delivered: boolean) =>
			audit.record({
				type: "auth.password_reset.requested",
				subject: user ? accountReference(user) : null,
				meta,
				metadata: { email: emailNormalized, delivered, reason },
			});

		if (!user) {
			await record("unknown_email", false);
			return;
		}
		if (!user.enabled) {
			await record("account_disabled", false);
			return;
		}

		// A link that was just sent is on its way; sending a second one only floods the mailbox.
		const open = await tokens.findOpenForUser(user.id, "password_reset", new Date());
		if (open && Date.now() - open.createdAt.getTime() < RESEND_COOLDOWN_MS) {
			await record("throttled", false);
			return;
		}

		const { token, record: stored } = await this.issue(user, "password_reset", PASSWORD_RESET_TTL_MS, null);
		const delivered = await mail.deliver(
			{
				template: "password_reset",
				data: {
					displayName: user.displayName,
					recipient: user.email,
					url: this.linkTo("/reset-password", token),
					requestedAt: stored.createdAt,
					expiresAt: stored.expiresAt,
					origin: { ipAddress: meta.ip, userAgent: meta.userAgent },
				},
			},
			locale,
			{ subject: accountReference(user), meta },
		);

		if (!delivered) {
			// Nothing reached the mailbox, so the link must not stay redeemable.
			await tokens.deleteFor(user.id, "password_reset");
		}
		await record(delivered ? null : "delivery_failed", delivered);
	}

	/** What the reset page may show before a new password is entered. */
	public async validatePasswordReset(token: string): Promise<PasswordResetTokenDto> {
		const found = await this.deps.tokens.find(sha256(token), "password_reset");
		if (!found || linkFailureOf(found, new Date())) {
			throw invalidToken();
		}

		return {
			maskedEmail: maskEmail(found.user.email),
			displayName: found.user.displayName,
			expiresAt: toIso(found.token.expiresAt),
		};
	}

	/**
	 * Redeems a reset link: the new password takes effect, every session, token and outstanding
	 * link of the account is revoked, and the owner is told that it happened.
	 */
	public async completePasswordReset(token: string, password: string, locale: Locale, meta: RequestMeta): Promise<void> {
		const { database, users, tokens, passwords, revoker, audit } = this.deps;
		const now = new Date();
		const found = await tokens.find(sha256(token), "password_reset");
		const failure = linkFailureOf(found, now);

		if (!found || failure) {
			await audit.record({
				type: "auth.password_reset.failed",
				subject: found ? accountReference(found.user) : null,
				meta,
				metadata: { reason: failure },
			});
			throw invalidToken();
		}

		const passwordHash = await passwords.hash(password);
		const { user } = found;

		await database.transaction(async () => {
			// The first click wins; a second one finds the token spent and is turned away.
			if (!(await tokens.consume(found.token.id, now))) {
				throw invalidToken();
			}
			// Clicking the link proved control of the mailbox it was sent to.
			await users.update(user.id, { passwordHash, passwordChangedAt: now, emailVerified: true }, now);
			await tokens.deleteOpenForUser(user.id);
			// Whoever forgot the password may not be whoever was signed in.
			await revoker.revokeUser(user.id);

			await audit.record({ type: "auth.password_reset.completed", subject: accountReference(user), meta });
		});

		await this.notifyPasswordChanged(user, now, locale, meta, null);
	}

	/** Tells the owner of an account that its password changed, while a stolen session could still be noticed. */
	public async notifyPasswordChanged(
		user: UserRecord,
		changedAt: Date,
		locale: Locale,
		meta: RequestMeta,
		actor: AuditReference | null,
	): Promise<void> {
		await this.deps.email.deliver(
			{
				template: "password_changed",
				data: {
					displayName: user.displayName,
					recipient: user.email,
					changedAt,
					origin: { ipAddress: meta.ip, userAgent: meta.userAgent },
				},
			},
			locale,
			{ subject: accountReference(user), actor, meta },
		);
	}

	/**
	 * Invalidates every link of the account that has not been redeemed yet. A new password or
	 * address must not be undone by a link that was sent before it.
	 */
	public revokeLinks(userId: string): Promise<void> {
		return this.deps.tokens.deleteOpenForUser(userId);
	}

	/** The e-mail change of an account that is waiting to be confirmed, if there is one. */
	public async pendingEmailChange(userId: string): Promise<PendingEmailChangeDto | null> {
		const open = await this.deps.tokens.findOpenForUser(userId, "email_change", new Date());
		return open ? toPendingDto(open) : null;
	}

	/**
	 * Starts an e-mail change: the new address gets a confirmation link, the current one a notice
	 * that the change was requested. Nothing about the account changes until the link is clicked.
	 *
	 * The caller has already confirmed the account's password.
	 */
	public async startEmailChange(user: UserRecord, newEmail: string, locale: Locale, meta: RequestMeta): Promise<PendingEmailChangeDto> {
		const { users, tokens, audit, email: mail } = this.deps;
		const emailNormalized = normalizeEmail(newEmail);

		const existing = await users.findByEmail(emailNormalized);
		if (existing && existing.id !== user.id) {
			throw emailTaken();
		}
		await tokens.deleteExpiredForTarget(emailNormalized, new Date());

		let issued: { token: string; record: AccountTokenRecord };
		try {
			issued = await this.issue(user, "email_change", EMAIL_CHANGE_TTL_MS, newEmail);
		} catch (error) {
			// Another account is already waiting to move to this address.
			if (isUniqueViolation(error)) {
				throw changePending();
			}
			throw error;
		}

		const { token, record } = issued;
		const reference = accountReference(user);
		const origin = { ipAddress: meta.ip, userAgent: meta.userAgent };
		try {
			await mail.send(
				{
					template: "email_change_confirm",
					data: {
						displayName: user.displayName,
						recipient: newEmail,
						currentEmail: user.email,
						url: this.linkTo("/verify-email", token),
						requestedAt: record.createdAt,
						expiresAt: record.expiresAt,
						origin,
					},
				},
				locale,
				{ subject: reference, actor: reference, meta },
			);
		} catch (error) {
			// A link nobody received must not stay redeemable, and the user should hear about it.
			await tokens.deleteFor(user.id, "email_change");
			throw error;
		}

		// The address that still owns the account hears about the change while it can still act.
		await mail.deliver(
			{
				template: "email_change_notice",
				data: {
					displayName: user.displayName,
					recipient: user.email,
					newEmail,
					requestedAt: record.createdAt,
					origin,
				},
			},
			locale,
			{ subject: reference, actor: reference, meta },
		);

		await audit.record({
			type: "user.email_change_requested",
			actor: reference,
			subject: reference,
			meta,
			metadata: { from: user.email, to: newEmail },
		});
		return toPendingDto(record);
	}

	/** Sends the confirmation link of the pending change again, with a fresh token. */
	public async resendEmailChange(user: UserRecord, locale: Locale, meta: RequestMeta): Promise<PendingEmailChangeDto> {
		const pending = await this.pendingEmailChange(user.id);
		if (!pending) {
			throw notFound("E-mail change");
		}
		return this.startEmailChange(user, pending.email, locale, meta);
	}

	/** Redeems a confirmation link and moves the account to its new address. */
	public async confirmEmailChange(token: string, meta: RequestMeta): Promise<{ email: string }> {
		const { database, users, tokens, audit } = this.deps;
		const now = new Date();
		const found = await tokens.find(sha256(token), "email_change");
		const failure = linkFailureOf(found, now);

		const recordFailure = (reason: LinkFailure | "email_taken") =>
			audit.record({
				type: "user.email_change_failed",
				subject: found ? accountReference(found.user) : null,
				meta,
				metadata: { reason },
			});

		if (!found?.token.targetEmail || !found.token.targetEmailNormalized || failure) {
			await recordFailure(failure ?? "invalid_token");
			throw invalidToken();
		}

		const { user } = found;
		const email = found.token.targetEmail;
		const emailNormalized = found.token.targetEmailNormalized;

		try {
			await database.transaction(async () => {
				if (!(await tokens.consume(found.token.id, now))) {
					throw invalidToken();
				}
				await users.update(user.id, { email, emailNormalized, emailVerified: true }, now);
				// A reset link on its way to the old address must not outlive the change.
				await tokens.deleteOpenForUser(user.id);

				await audit.record({
					type: "user.email_change_confirmed",
					actor: accountReference(user),
					subject: { id: user.id, label: email },
					meta,
					metadata: { from: user.email, to: email },
				});
			});
		} catch (error) {
			// The address was claimed by another account while the link sat in a mailbox.
			if (isUniqueViolation(error)) {
				await tokens.deleteFor(user.id, "email_change");
				await recordFailure("email_taken");
				throw emailTaken();
			}
			throw error;
		}
		return { email };
	}

	/** Drops a pending change; the account keeps the address it signs in with. */
	public async cancelEmailChange(user: UserRecord, meta: RequestMeta): Promise<void> {
		const { tokens, audit } = this.deps;
		const open = await tokens.findOpenForUser(user.id, "email_change", new Date());
		await tokens.deleteFor(user.id, "email_change");

		if (open) {
			await audit.record({
				type: "user.email_change_cancelled",
				actor: accountReference(user),
				subject: accountReference(user),
				meta,
				metadata: { to: open.targetEmail },
			});
		}
	}

	/** Replaces any outstanding link of this purpose with a fresh one. */
	private async issue(
		user: UserRecord,
		purpose: AccountTokenPurpose,
		ttlMs: number,
		targetEmail: string | null,
	): Promise<{ token: string; record: AccountTokenRecord }> {
		const { tokens } = this.deps;
		const token = randomToken(TOKEN_BYTES);
		const now = new Date();

		await tokens.deleteFor(user.id, purpose);
		const record = await tokens.insert({
			id: newId(),
			userId: user.id,
			purpose,
			tokenHash: sha256(token),
			targetEmail,
			targetEmailNormalized: targetEmail ? normalizeEmail(targetEmail) : null,
			expiresAt: new Date(now.getTime() + ttlMs),
			createdAt: now,
		});
		return { token, record };
	}

	private linkTo(path: string, token: string): string {
		return `${this.deps.issuer}${path}#token=${encodeURIComponent(token)}`;
	}
}
