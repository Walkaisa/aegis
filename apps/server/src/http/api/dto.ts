import {
	type AuthRequestAccount,
	type AuthRequestClient,
	type AuthSessionResponse,
	applicationLogoUrl,
	avatarUrl,
	type ClientDto,
	type ClientSessionDto,
	type ClientUserDto,
	type InstanceSettingsDto,
	ROLE_PERMISSIONS,
	type SessionDto,
	type SigningKeyDto,
	type SupportedScope,
	type UserApplicationDto,
	type UserDto,
} from "@aegis/contracts";
import type { OidcClientRecord, SessionRecord, SigningKeyRecord, SystemSettingsRecord, UserRecord } from "@aegis/db";
import { SECOND_MS, toIso, toIsoOrNull } from "../../lib/time.js";
import type { AssignedUserRow } from "../../repositories/client-assignments.js";
import type { ClientSummary } from "../../repositories/clients.js";
import type { ClientSessionRow, SessionApplicationRow, SessionWithUser } from "../../repositories/sessions.js";
import type { UserSummary } from "../../repositories/users.js";
import type { AccountApplication } from "../../services/application-access.js";
import { isTwoFactorEnabled } from "../../services/two-factor.js";

export function toUserDto(user: UserSummary): UserDto {
	return {
		id: user.id,
		email: user.email,
		displayName: user.displayName,
		role: user.role,
		enabled: user.enabled,
		emailVerified: user.emailVerified,
		avatarUrl: avatarUrl(user.id, user.avatarHash),
		activeSessionCount: user.activeSessionCount,
		isLastActiveAdmin: user.isLastActiveAdmin,
		lastSignInAt: toIsoOrNull(user.lastSignInAt),
		passwordChangedAt: toIso(user.passwordChangedAt),
		twoFactorEnabled: isTwoFactorEnabled(user),
		createdAt: toIso(user.createdAt),
		updatedAt: toIso(user.updatedAt),
	};
}

export function toAuthSessionResponse(account: UserSummary, session: SessionRecord, instanceName: string): AuthSessionResponse {
	return {
		account: toUserDto(account),
		session: {
			id: session.id,
			authenticatedAt: toIso(session.authenticatedAt),
			expiresAt: toIso(session.expiresAt),
		},
		permissions: [...ROLE_PERMISSIONS[account.role]],
		instanceName,
	};
}

export function toClientDto(client: ClientSummary): ClientDto {
	return {
		id: client.id,
		name: client.name,
		description: client.description,
		type: client.clientType,
		tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
		redirectUris: client.redirectUris,
		postLogoutRedirectUris: client.postLogoutRedirectUris,
		// The database constraint restricts the column to the supported scopes.
		allowedScopes: client.allowedScopes as SupportedScope[],
		skipConsent: client.skipConsent,
		enabled: client.enabled,
		accessPolicy: client.accessPolicy,
		pkcePolicy: client.pkcePolicy,
		assignedUserCount: client.assignedUserCount,
		logoUrl: applicationLogoUrl(client.id, client.logoHash),
		activeSessionCount: client.activeSessionCount,
		lastAuthorizedAt: toIsoOrNull(client.lastAuthorizedAt),
		secretRotatedAt: toIsoOrNull(client.clientSecretRotatedAt),
		createdAt: toIso(client.createdAt),
		updatedAt: toIso(client.updatedAt),
	};
}

/** The application behind an authorization request, as the sign-in and consent pages show it. */
export function toAuthRequestClient(client: OidcClientRecord, redirectUri: string | null): AuthRequestClient {
	const url = redirectUri ? URL.parse(redirectUri) : null;
	return {
		id: client.id,
		name: client.name,
		description: client.description,
		logoUrl: applicationLogoUrl(client.id, client.logoHash),
		redirectOrigin: url ? url.host || url.protocol.replace(/:$/, "") : null,
	};
}

/** An account on the sign-in and consent pages. */
export function toAuthRequestAccount(user: UserRecord): AuthRequestAccount {
	return { displayName: user.displayName, email: user.email, avatarUrl: avatarUrl(user.id, user.avatarHash) };
}

export function toClientUserDto(row: AssignedUserRow): ClientUserDto {
	return {
		id: row.user.id,
		displayName: row.user.displayName,
		email: row.user.email,
		role: row.user.role,
		enabled: row.user.enabled,
		avatarUrl: avatarUrl(row.user.id, row.user.avatarHash),
		assignedAt: toIso(row.assignedAt),
	};
}

export function toUserApplicationDto({ client, assigned, canSignIn }: AccountApplication): UserApplicationDto {
	return {
		id: client.id,
		name: client.name,
		logoUrl: applicationLogoUrl(client.id, client.logoHash),
		enabled: client.enabled,
		accessPolicy: client.accessPolicy,
		assigned,
		canSignIn,
	};
}

export function toSessionDto(row: SessionWithUser, applications: SessionApplicationRow[], currentSessionId: string): SessionDto {
	return {
		id: row.session.id,
		current: row.session.id === currentSessionId,
		account: {
			id: row.user.id,
			displayName: row.user.displayName,
			email: row.user.email,
			role: row.user.role,
			avatarUrl: avatarUrl(row.user.id, row.user.avatarHash),
		},
		authenticatedAt: toIso(row.session.authenticatedAt),
		secondFactor: row.session.amr.includes("mfa"),
		lastSeenAt: toIso(row.session.lastSeenAt),
		expiresAt: toIso(row.session.expiresAt),
		ipAddress: row.session.ipAddress,
		userAgent: row.session.userAgent,
		applications: applications.map((application) => ({
			id: application.clientId,
			name: application.clientName,
			logoUrl: applicationLogoUrl(application.clientId, application.clientLogoHash),
			lastAuthorizedAt: toIso(application.lastAuthorizedAt),
		})),
	};
}

export function toClientSessionDto(row: ClientSessionRow): ClientSessionDto {
	return {
		sessionId: row.session.id,
		account: {
			id: row.user.id,
			displayName: row.user.displayName,
			email: row.user.email,
			avatarUrl: avatarUrl(row.user.id, row.user.avatarHash),
		},
		ipAddress: row.session.ipAddress,
		userAgent: row.session.userAgent,
		firstAuthorizedAt: toIso(row.firstAuthorizedAt),
		lastAuthorizedAt: toIso(row.lastAuthorizedAt),
		lastSeenAt: toIso(row.session.lastSeenAt),
		expiresAt: toIso(row.session.expiresAt),
	};
}

export function toInstanceSettingsDto(settings: SystemSettingsRecord, issuer: string): InstanceSettingsDto {
	return {
		instanceName: settings.instanceName,
		sessionTtlDays: Math.round((settings.sessionTtlSeconds * SECOND_MS) / 86_400_000),
		auditRetentionDays: settings.auditRetentionDays,
		issuer,
		setupCompletedAt: toIso(settings.setupCompletedAt),
	};
}

export function toSigningKeyDto(key: SigningKeyRecord): SigningKeyDto {
	return {
		kid: key.kid,
		alg: key.algorithm,
		status: key.status,
		createdAt: toIso(key.createdAt),
		retiredAt: toIsoOrNull(key.retiredAt),
	};
}
