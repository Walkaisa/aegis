import {
	type AuditEventDto,
	type AuthRequestClient,
	type AuthRequestConsentPrompt,
	type AuthRequestSignInPrompt,
	type AuthSessionResponse,
	auditCategoryOf,
	auditOutcomeOf,
	auditSeverityOf,
	auditSpecOf,
	auditTargetTypeOf,
	type ClientDto,
	type ClientSessionDto,
	type ClientUserDto,
	type EmailSettingsDto,
	type InstanceInfo,
	type OverviewDto,
	PERMISSIONS,
	ROLE_PERMISSIONS,
	type SecondFactorPrompt,
	type SecurityOverviewDto,
	type SessionDto,
	type TwoFactorSetupResponse,
	type TwoFactorStatusDto,
	type UserApplicationDto,
	type UserDto,
	type VersionStatusDto,
} from "@aegis/contracts";

/**
 * API responses as the backend sends them, with plausible defaults. Every builder takes the fields a
 * test cares about; ids are snowflakes like the real ones.
 */

export const NOW = "2026-01-15T12:00:00.000Z";
const EARLIER = "2026-01-01T09:30:00.000Z";

export function user(overrides: Partial<UserDto> = {}): UserDto {
	return {
		id: "3220506287531888640",
		email: "ada@example.com",
		displayName: "Ada Lovelace",
		role: "admin",
		enabled: true,
		emailVerified: true,
		avatarUrl: null,
		activeSessionCount: 1,
		isLastActiveAdmin: false,
		lastSignInAt: NOW,
		passwordChangedAt: EARLIER,
		twoFactorEnabled: false,
		createdAt: EARLIER,
		updatedAt: EARLIER,
		...overrides,
	};
}

/** The signed-in administration account (`/api/auth/session`). */
export function me(overrides: Partial<UserDto> = {}, instanceName = "Example SSO"): AuthSessionResponse {
	const account = user(overrides);
	return {
		account,
		session: { id: "3220506287531888641", authenticatedAt: NOW, expiresAt: "2026-02-14T12:00:00.000Z" },
		permissions: account.role === "admin" ? [...PERMISSIONS] : [...ROLE_PERMISSIONS[account.role]],
		instanceName,
	};
}

export function client(overrides: Partial<ClientDto> = {}): ClientDto {
	return {
		id: "3220506287531888700",
		name: "Wiki",
		description: "Team wiki",
		type: "confidential",
		tokenEndpointAuthMethod: "client_secret_basic",
		redirectUris: ["https://wiki.example.com/api/auth/callback/aegis"],
		postLogoutRedirectUris: ["https://wiki.example.com/"],
		allowedScopes: ["openid", "profile", "email"],
		skipConsent: false,
		enabled: true,
		accessPolicy: "everyone",
		pkcePolicy: "optional",
		assignedUserCount: 0,
		logoUrl: null,
		activeSessionCount: 0,
		lastAuthorizedAt: null,
		secretRotatedAt: EARLIER,
		createdAt: EARLIER,
		updatedAt: EARLIER,
		...overrides,
	};
}

export function session(overrides: Partial<SessionDto> = {}): SessionDto {
	return {
		id: "3220506287531888641",
		current: false,
		account: { id: "3220506287531888640", displayName: "Ada Lovelace", email: "ada@example.com", role: "admin", avatarUrl: null },
		authenticatedAt: EARLIER,
		secondFactor: false,
		lastSeenAt: NOW,
		expiresAt: "2026-02-14T12:00:00.000Z",
		ipAddress: "203.0.113.7",
		userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0",
		applications: [],
		...overrides,
	};
}

export function clientSession(overrides: Partial<ClientSessionDto> = {}): ClientSessionDto {
	return {
		sessionId: "3220506287531888641",
		account: { id: "3220506287531888640", displayName: "Ada Lovelace", email: "ada@example.com", avatarUrl: null },
		ipAddress: "203.0.113.7",
		userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
		firstAuthorizedAt: EARLIER,
		lastAuthorizedAt: NOW,
		lastSeenAt: NOW,
		expiresAt: "2026-02-14T12:00:00.000Z",
		...overrides,
	};
}

export function clientUser(overrides: Partial<ClientUserDto> = {}): ClientUserDto {
	return {
		id: "3220506287531888650",
		displayName: "Grace Hopper",
		email: "grace@example.com",
		role: "user",
		enabled: true,
		avatarUrl: null,
		assignedAt: EARLIER,
		...overrides,
	};
}

export function userApplication(overrides: Partial<UserApplicationDto> = {}): UserApplicationDto {
	return {
		id: "3220506287531888700",
		name: "Wiki",
		logoUrl: null,
		enabled: true,
		accessPolicy: "everyone",
		assigned: false,
		canSignIn: true,
		...overrides,
	};
}

let eventNumber = 0;

/** An audit event with severity, outcome, category and target derived like the backend does. */
export function auditEvent(type: AuditEventDto["type"], overrides: Partial<AuditEventDto> = {}): AuditEventDto {
	eventNumber += 1;
	const metadata = overrides.metadata ?? {};
	return {
		id: String(3220506287531889000n + BigInt(eventNumber)),
		type,
		category: auditCategoryOf(type),
		severity: auditSeverityOf(type, metadata),
		outcome: auditOutcomeOf(type),
		source: auditSpecOf(type).source,
		targetType: auditTargetTypeOf(type),
		occurredAt: NOW,
		actor: { id: "3220506287531888640", label: "ada@example.com", name: "Ada Lovelace", role: "admin", imageUrl: null },
		subject: null,
		client: null,
		ipAddress: "203.0.113.7",
		userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0 Safari/537.36",
		metadata,
		...overrides,
	};
}

export function overview(overrides: Partial<OverviewDto> = {}): OverviewDto {
	return {
		instanceName: "Example SSO",
		generatedAt: NOW,
		stats: { applications: 3, users: 12, admins: 2, activeSessions: 5, signIns24h: 8, failedSignIns24h: 1 },
		activity: Array.from({ length: 14 }, (_, index) => ({
			date: `2026-01-${String(index + 2).padStart(2, "0")}`,
			succeeded: index,
			failed: index % 3,
		})),
		topApplications: [{ id: "3220506287531888700", name: "Wiki", logoUrl: null, authorizations: 42 }],
		recentEvents: [auditEvent("auth.sign_in.succeeded", { metadata: { context: "admin", secondFactor: null } })],
		...overrides,
	};
}

export function versionStatus(overrides: Partial<VersionStatusDto> = {}): VersionStatusDto {
	return {
		current: "1.2.0",
		checkEnabled: true,
		latest: { version: "1.2.0", url: "https://github.com/Walkaisa/aegis/releases/tag/v1.2.0", publishedAt: EARLIER },
		updateAvailable: false,
		checkedAt: NOW,
		checkFailed: false,
		...overrides,
	};
}

export function emailSettings(overrides: Partial<EmailSettingsDto> = {}): EmailSettingsDto {
	return {
		enabled: true,
		configured: true,
		host: "smtp.example.com",
		port: 587,
		security: "starttls",
		username: "aegis",
		hasPassword: true,
		fromName: "Example SSO",
		fromAddress: "sso@example.com",
		replyTo: null,
		allowInvalidCertificate: false,
		lastVerifiedAt: NOW,
		updatedAt: NOW,
		...overrides,
	};
}

export function securityOverview(overrides: Partial<SecurityOverviewDto> = {}): SecurityOverviewDto {
	return {
		signingKeys: [{ kid: "kid-active", alg: "RS256", status: "active", createdAt: NOW, retiredAt: null }],
		retiredKeyRetentionDays: 7,
		argon2: { memoryKiB: 65536, iterations: 3, parallelism: 1 },
		...overrides,
	};
}

export function twoFactorStatus(overrides: Partial<TwoFactorStatusDto> = {}): TwoFactorStatusDto {
	return { enabled: true, enabledAt: EARLIER, label: "1Password", recoveryCodesRemaining: 10, ...overrides };
}

export function twoFactorSetup(overrides: Partial<TwoFactorSetupResponse> = {}): TwoFactorSetupResponse {
	return {
		secret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
		otpauthUri: "otpauth://totp/Example%20SSO:ada%40example.com?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Example%20SSO",
		issuer: "Example SSO",
		accountName: "ada@example.com",
		digits: 6,
		period: 30,
		...overrides,
	};
}

/** Recovery codes in the format the backend issues them. */
export const RECOVERY_CODES = Array.from({ length: 10 }, (_, index) => `K7PQM-${String(index).padStart(5, "0")}`);

export function secondFactorPrompt(overrides: Partial<SecondFactorPrompt> = {}): SecondFactorPrompt {
	return {
		type: "second_factor",
		account: { displayName: "Ada Lovelace", email: "ada@example.com", avatarUrl: null },
		methods: ["totp", "recovery_code"],
		expiresAt: NOW,
		...overrides,
	};
}

export function authRequestClient(overrides: Partial<AuthRequestClient> = {}): AuthRequestClient {
	return {
		id: "3220506287531888700",
		name: "Wiki",
		description: "The team wiki",
		logoUrl: null,
		redirectOrigin: "https://wiki.example.com",
		...overrides,
	};
}

export function signInPrompt(overrides: Partial<AuthRequestSignInPrompt> = {}): AuthRequestSignInPrompt {
	return {
		type: "sign_in",
		challenge: "challenge-1",
		instanceName: "Example SSO",
		client: authRequestClient(),
		emailHint: null,
		reauthenticationRequired: false,
		deniedAccount: null,
		scopes: ["openid", "profile", "email"],
		passwordResetEnabled: false,
		...overrides,
	};
}

export function consentPrompt(overrides: Partial<AuthRequestConsentPrompt> = {}): AuthRequestConsentPrompt {
	return {
		type: "consent",
		challenge: "challenge-1",
		instanceName: "Example SSO",
		client: authRequestClient(),
		account: { displayName: "Ada Lovelace", email: "ada@example.com", avatarUrl: null },
		scopes: ["openid", "email"],
		...overrides,
	};
}

export function instanceInfo(overrides: Partial<InstanceInfo> = {}): InstanceInfo {
	return {
		setupRequired: false,
		instanceName: "Example SSO",
		issuer: "https://auth.example.com",
		version: "1.2.0",
		passwordResetEnabled: true,
		...overrides,
	};
}
