import {
	ACR_VALUES,
	type AcrValue,
	type AuditSource,
	type AuthenticationMethod,
	hasPermission,
	normalizeEmail,
	type SecondFactorMethod,
} from "@aegis/contracts";
import type { OidcClientRecord, SessionRecord, UserRecord } from "@aegis/db";
import type { PasswordHasher } from "../crypto/passwords.js";
import { randomToken, sha256 } from "../crypto/tokens.js";
import { ApiError } from "../lib/errors.js";
import { newId } from "../lib/snowflakes.js";
import { MINUTE_MS } from "../lib/time.js";
import type { AuditLog } from "../repositories/audit.js";
import type { SessionRepository } from "../repositories/sessions.js";
import type { SettingsRepository } from "../repositories/settings.js";
import type { UserRepository } from "../repositories/users.js";
import type { ApplicationAccess } from "./application-access.js";
import { clientReference } from "./clients.js";
import { DEFAULT_SESSION_TTL_SECONDS, getSessionPolicy } from "./session-policy.js";
import type { SignInThrottle } from "./sign-in-throttle.js";
import type { TwoFactorService } from "./two-factor.js";
import { accountReference } from "./users.js";

export interface RequestMeta {
	ip: string | null;
	userAgent: string | null;
}

export interface AuthenticatedSession {
	user: UserRecord;
	session: SessionRecord;
}

/**
 * Where a sign-in takes place: the administration, which requires `console:access`, or an
 * application, which requires access to it. Both start the same session.
 */
export type SignInTarget = { context: "admin" } | { context: "oidc"; client: OidcClientRecord };

/** The audit log distinguishes signing in to the administration from signing in to an application. */
const CONTEXT_AUDIT_SOURCES: Record<SignInTarget["context"], AuditSource> = { admin: "admin", oidc: "user" };

type SignInFailureReason =
	| "throttled"
	| "unknown_email"
	| "invalid_password"
	| "account_disabled"
	| "not_permitted"
	| "invalid_second_factor";

/** How a sign-in was authenticated (RFC 8176): the password, plus the second factor if one was used. */
export function authenticationMethodsOf(secondFactor: SecondFactorMethod | null): AuthenticationMethod[] {
	switch (secondFactor) {
		case "totp":
			return ["pwd", "otp", "mfa"];
		case "recovery_code":
			return ["pwd", "mfa"];
		case null:
			return ["pwd"];
	}
}

/** The authentication context class of a sign-in, derived from its authentication methods. */
export function acrOf(amr: readonly string[]): AcrValue {
	return amr.includes("mfa") ? ACR_VALUES.mfa : ACR_VALUES.password;
}

export interface AuthServiceDependencies {
	users: UserRepository;
	sessions: SessionRepository;
	settings: SettingsRepository;
	passwords: PasswordHasher;
	audit: AuditLog;
	throttle: SignInThrottle;
	access: ApplicationAccess;
	twoFactor: TwoFactorService;
}

const SESSION_TOUCH_INTERVAL_MS = MINUTE_MS;
const MAX_TOKEN_LENGTH = 256;

/** The same response for every failure, so callers cannot learn whether an account exists. */
const signInFailed = () => new ApiError(401, "sign_in_failed", "Sign-in failed");
const signInThrottled = () => new ApiError(429, "sign_in_throttled", "Too many failed sign-in attempts. Try again later.");
const notPermitted = (target: SignInTarget) =>
	target.context === "admin"
		? new ApiError(403, "forbidden", "This account may not use the administration")
		: new ApiError(403, "application_access_denied", "This account may not sign in to the application");

function credentialFailureOf(user: UserRecord | null, passwordValid: boolean): SignInFailureReason | null {
	if (!user) {
		return "unknown_email";
	}
	if (!passwordValid) {
		return "invalid_password";
	}
	if (!user.enabled) {
		return "account_disabled";
	}
	return null;
}

export class AuthService {
	private readonly deps: AuthServiceDependencies;

	public constructor(deps: AuthServiceDependencies) {
		this.deps = deps;
	}

	/**
	 * Verifies e-mail address and password, then whether the account may sign in where it tries to.
	 * The password is always verified, so an unknown e-mail address cannot be detected through
	 * response timing, and missing access is only reported after correct credentials. The sign-in is
	 * not complete yet: accounts with two-factor authentication confirm a code first, then
	 * `completeSignIn` records it.
	 */
	public async verifyPassword(email: string, password: string, meta: RequestMeta, target: SignInTarget): Promise<UserRecord> {
		const { users, passwords, throttle } = this.deps;
		const throttleKey = meta.ip ?? "unknown";
		const emailNormalized = normalizeEmail(email);

		if (throttle.isBlocked(throttleKey)) {
			await this.recordFailure("throttled", emailNormalized, null, target, meta);
			throw signInThrottled();
		}

		const user = await users.findByEmail(emailNormalized);
		let passwordValid = false;
		if (user) {
			passwordValid = await passwords.verify(user.passwordHash, password);
		} else {
			await passwords.verifyDummy(password);
		}

		const reason = credentialFailureOf(user, passwordValid);
		if (!user || reason) {
			// Only guessing counts towards the throttle.
			if (reason === "unknown_email" || reason === "invalid_password") {
				throttle.registerFailure(throttleKey);
			}
			await this.recordFailure(reason ?? "unknown_email", emailNormalized, user, target, meta);
			throw signInFailed();
		}

		if (!(await this.isPermitted(user, target))) {
			await this.recordFailure("not_permitted", emailNormalized, user, target, meta);
			throw notPermitted(target);
		}

		if (passwords.needsRehash(user.passwordHash)) {
			await users.replacePasswordHash(user.id, await passwords.hash(password));
		}
		return user;
	}

	/**
	 * Verifies the second factor of a sign-in whose password was confirmed before. The account is
	 * checked again, since it may have been disabled or lost its access in the meantime. Wrong codes
	 * count towards the same throttle as wrong passwords.
	 */
	public async verifySecondFactor(
		userId: string,
		code: string,
		meta: RequestMeta,
		target: SignInTarget,
	): Promise<{ user: UserRecord; method: SecondFactorMethod }> {
		const { users, throttle, twoFactor } = this.deps;
		const throttleKey = meta.ip ?? "unknown";
		const user = await users.findById(userId);

		if (throttle.isBlocked(throttleKey)) {
			await this.recordFailure("throttled", user?.emailNormalized ?? "", user, target, meta);
			throw signInThrottled();
		}
		if (!user?.enabled) {
			throw signInFailed();
		}

		const method = await twoFactor.verify(user, code);
		if (!method) {
			throttle.registerFailure(throttleKey);
			await this.recordFailure("invalid_second_factor", user.emailNormalized, user, target, meta);
			throw new ApiError(401, "second_factor_invalid", "The code is invalid or has already been used");
		}

		if (!(await this.isPermitted(user, target))) {
			await this.recordFailure("not_permitted", user.emailNormalized, user, target, meta);
			throw notPermitted(target);
		}
		return { user, method };
	}

	/** Records a successful sign-in once every required factor has been confirmed. */
	public async completeSignIn(
		user: UserRecord,
		secondFactor: SecondFactorMethod | null,
		meta: RequestMeta,
		target: SignInTarget,
	): Promise<UserRecord> {
		const { users, throttle, audit } = this.deps;
		throttle.reset(meta.ip ?? "unknown");
		const now = new Date();

		await users.touchSignIn(user.id, now);
		await audit.record({
			type: "auth.sign_in.succeeded",
			actor: accountReference(user),
			subject: accountReference(user),
			source: CONTEXT_AUDIT_SOURCES[target.context],
			client: target.context === "oidc" ? clientReference(target.client) : null,
			meta,
			metadata: { context: target.context, secondFactor },
		});

		return { ...user, lastSignInAt: now };
	}

	public async createSession(
		user: UserRecord,
		meta: RequestMeta,
		{ amr = ["pwd"], authenticatedAt = new Date() }: { amr?: AuthenticationMethod[]; authenticatedAt?: Date } = {},
	): Promise<{ token: string; session: SessionRecord }> {
		const sessionTtlSeconds = this.deps.settings.get()?.sessionTtlSeconds ?? DEFAULT_SESSION_TTL_SECONDS;
		const policy = getSessionPolicy(user.role, sessionTtlSeconds);
		const now = new Date();
		const token = randomToken(32);

		const session = await this.deps.sessions.insert({
			id: newId(),
			userId: user.id,
			tokenHash: sha256(token),
			authenticatedAt,
			amr,
			createdAt: now,
			lastSeenAt: now,
			expiresAt: new Date(now.getTime() + policy.ttlMs),
			ipAddress: meta.ip,
			userAgent: meta.userAgent,
		});
		return { token, session };
	}

	public endSession(sessionId: string): Promise<boolean> {
		return this.deps.sessions.delete(sessionId);
	}

	public async signOut(auth: AuthenticatedSession, meta: RequestMeta): Promise<void> {
		await this.deps.sessions.delete(auth.session.id);
		await this.deps.audit.record({
			type: "auth.sign_out",
			actor: accountReference(auth.user),
			subject: accountReference(auth.user),
			source: hasPermission(auth.user.role, "console:access") ? "admin" : "user",
			meta,
			metadata: { role: auth.user.role },
		});
	}

	/**
	 * Resolves a session cookie value. The session only counts while it is active and its account is
	 * enabled; what the account may do with it is decided by its role.
	 */
	public async resolveSession(token: string | undefined | null): Promise<AuthenticatedSession | null> {
		if (!token || token.length > MAX_TOKEN_LENGTH) {
			return null;
		}

		const now = new Date();
		const found = await this.deps.sessions.findActiveByTokenHash(sha256(token), now);
		if (!found?.user.enabled) {
			return null;
		}

		if (now.getTime() - found.session.lastSeenAt.getTime() > SESSION_TOUCH_INTERVAL_MS) {
			await this.deps.sessions.touch(found.session.id, now);
			found.session.lastSeenAt = now;
		}

		return found;
	}

	private isPermitted(user: UserRecord, target: SignInTarget): Promise<boolean> {
		return target.context === "admin"
			? Promise.resolve(hasPermission(user.role, "console:access"))
			: this.deps.access.allows(user, target.client);
	}

	private async recordFailure(
		reason: SignInFailureReason,
		emailNormalized: string,
		user: UserRecord | null,
		target: SignInTarget,
		meta: RequestMeta,
	): Promise<void> {
		await this.deps.audit.record({
			type: "auth.sign_in.failed",
			subject: user ? accountReference(user) : null,
			source: CONTEXT_AUDIT_SOURCES[target.context],
			client: target.context === "oidc" ? clientReference(target.client) : null,
			meta,
			metadata: { email: emailNormalized, reason, context: target.context },
		});
	}
}
