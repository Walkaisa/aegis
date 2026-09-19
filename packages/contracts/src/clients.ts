import { z } from "zod";
import type { IsoDateString } from "./common";
import type { Role } from "./roles";
import type { Snowflake } from "./snowflakes";

/** Scopes Aegis supports; every application allows a subset of them (`allowedScopes`). */
export const SUPPORTED_SCOPES = ["openid", "profile", "email"] as const;
export type SupportedScope = (typeof SUPPORTED_SCOPES)[number];

/**
 * Who may sign in to an application. Admins may sign in to every application; everybody else
 * depends on the policy:
 * - `everyone`: every enabled account,
 * - `assigned`: only the accounts assigned to the application.
 */
export const CLIENT_ACCESS_POLICIES = ["everyone", "assigned"] as const;
export type ClientAccessPolicy = (typeof CLIENT_ACCESS_POLICIES)[number];

const accessPolicySchema = z.enum(CLIENT_ACCESS_POLICIES, { error: "invalid" });

export const CLIENT_TYPES = ["confidential", "public"] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_AUTH_METHODS = ["client_secret_basic", "client_secret_post"] as const;
export type ClientAuthMethod = (typeof CLIENT_AUTH_METHODS)[number];

/**
 * How an application uses PKCE (RFC 7636) in the authorization code flow. Only S256 is supported.
 * - `required`: every authorization request must carry a `code_challenge`,
 * - `optional`: PKCE may be used; a `code_challenge` that was sent is always verified,
 * - `disabled`: PKCE is not expected; confidential clients authenticate with their secret instead.
 *
 * Public clients have no secret, so PKCE is their only protection of the code exchange: they are
 * always `required`.
 */
export const PKCE_POLICIES = ["required", "optional", "disabled"] as const;
export type PkcePolicy = (typeof PKCE_POLICIES)[number];

/** The policies a client type may use; the first one is the default. */
export const PKCE_POLICIES_BY_TYPE: Record<ClientType, readonly [PkcePolicy, ...PkcePolicy[]]> = {
	confidential: ["optional", "required", "disabled"],
	public: ["required"],
};

const pkcePolicySchema = z.enum(PKCE_POLICIES, { error: "invalid" });

export const MAX_REDIRECT_URIS = 20;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export type RedirectUriKind = "https" | "loopback" | "custom_scheme";

/**
 * Validates a single redirect URI. Redirect URIs are always compared by exact string
 * match, so wildcards, fragments and embedded credentials are rejected outright.
 */
export function classifyRedirectUri(value: string): { ok: true; kind: RedirectUriKind } | { ok: false; code: string } {
	if (value.includes("*")) {
		return { ok: false, code: "redirect_uri_wildcard" };
	}
	if (value.includes("#")) {
		return { ok: false, code: "redirect_uri_fragment" };
	}
	if (/\s/.test(value)) {
		return { ok: false, code: "redirect_uri_invalid" };
	}

	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return { ok: false, code: "redirect_uri_invalid" };
	}

	if (url.username || url.password) {
		return { ok: false, code: "redirect_uri_credentials" };
	}

	if (url.protocol === "https:") {
		return url.hostname ? { ok: true, kind: "https" } : { ok: false, code: "redirect_uri_invalid" };
	}

	if (url.protocol === "http:") {
		return LOOPBACK_HOSTS.has(url.hostname) ? { ok: true, kind: "loopback" } : { ok: false, code: "redirect_uri_insecure" };
	}

	// Private-use URI schemes for native apps (RFC 8252 §7.1) must use reverse domain notation.
	const scheme = url.protocol.slice(0, -1);
	if (/^[a-z][a-z0-9+.-]*\.[a-z0-9+.-]+$/.test(scheme)) {
		return { ok: true, kind: "custom_scheme" };
	}

	return { ok: false, code: "redirect_uri_invalid" };
}

export const redirectUriSchema = z
	.string({ error: "required" })
	.trim()
	.min(1, { error: "required" })
	.max(2000, { error: "too_long" })
	.superRefine((value, ctx) => {
		const result = classifyRedirectUri(value);
		if (!result.ok) {
			ctx.addIssue({ code: "custom", message: result.code });
		}
	});

/** `openid` is always required; duplicates are removed and the order is canonical. */
export const allowedScopesSchema = z
	.array(z.enum(SUPPORTED_SCOPES, { error: "invalid" }))
	.refine((scopes) => scopes.includes("openid"), { error: "scope_openid_required" })
	.transform((scopes): SupportedScope[] => SUPPORTED_SCOPES.filter((s) => scopes.includes(s)));

function refinePkcePolicy(value: { pkcePolicy?: PkcePolicy | undefined }, ctx: z.RefinementCtx, type: ClientType) {
	if (value.pkcePolicy !== undefined && !PKCE_POLICIES_BY_TYPE[type].includes(value.pkcePolicy)) {
		ctx.addIssue({ code: "custom", message: "pkce_required_for_public_clients", path: ["pkcePolicy"] });
	}
}

function refineRedirectUris(value: { redirectUris: string[]; postLogoutRedirectUris: string[] }, ctx: z.RefinementCtx, type: ClientType) {
	for (const field of ["redirectUris", "postLogoutRedirectUris"] as const) {
		const seen = new Set<string>();
		value[field].forEach((uri, index) => {
			if (seen.has(uri)) {
				ctx.addIssue({ code: "custom", message: "redirect_uri_duplicate", path: [field, index] });
			}
			seen.add(uri);

			const result = classifyRedirectUri(uri);
			if (result.ok && result.kind === "custom_scheme" && type === "confidential") {
				ctx.addIssue({
					code: "custom",
					message: "redirect_uri_custom_scheme",
					path: [field, index],
				});
			}
		});
	}
}

const clientFields = {
	name: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(100, { error: "too_long" }),
	description: z.string().trim().max(500, { error: "too_long" }),
	tokenEndpointAuthMethod: z.enum(CLIENT_AUTH_METHODS, { error: "invalid" }),
	redirectUris: z
		.array(redirectUriSchema)
		.min(1, { error: "redirect_uris_required" })
		.max(MAX_REDIRECT_URIS, { error: "too_many_items" }),
	postLogoutRedirectUris: z.array(redirectUriSchema).max(MAX_REDIRECT_URIS, { error: "too_many_items" }),
	allowedScopes: allowedScopesSchema,
	skipConsent: z.boolean(),
};

export const clientCreateSchema = z
	.object({
		...clientFields,
		type: z.enum(CLIENT_TYPES, { error: "invalid" }),
		accessPolicy: accessPolicySchema.default("everyone"),
		/** Defaults to the first policy of `PKCE_POLICIES_BY_TYPE` for the client type. */
		pkcePolicy: pkcePolicySchema.optional(),
	})
	.superRefine((value, ctx) => {
		refineRedirectUris(value, ctx, value.type);
		refinePkcePolicy(value, ctx, value.type);
	})
	.transform(({ pkcePolicy, ...value }) => ({ ...value, pkcePolicy: pkcePolicy ?? PKCE_POLICIES_BY_TYPE[value.type][0] }));

export type ClientCreateRequest = z.infer<typeof clientCreateSchema>;

/** The client type is immutable after creation; changing it would change the security model. */
export function clientUpdateSchemaFor(type: ClientType) {
	return z
		.object({
			...clientFields,
			accessPolicy: accessPolicySchema,
			pkcePolicy: pkcePolicySchema,
			enabled: z.boolean(),
		})
		.superRefine((value, ctx) => {
			refineRedirectUris(value, ctx, type);
			refinePkcePolicy(value, ctx, type);
		});
}

export type ClientUpdateRequest = z.infer<ReturnType<typeof clientUpdateSchemaFor>>;

export interface ClientDto {
	/** The application's snowflake, which is also its public OAuth `client_id`. */
	id: Snowflake;
	name: string;
	description: string;
	type: ClientType;
	tokenEndpointAuthMethod: ClientAuthMethod | "none";
	redirectUris: string[];
	postLogoutRedirectUris: string[];
	allowedScopes: SupportedScope[];
	skipConsent: boolean;
	enabled: boolean;
	accessPolicy: ClientAccessPolicy;
	pkcePolicy: PkcePolicy;
	/** Accounts assigned to the application. */
	assignedUserCount: number;
	/** `/api/media/logos/<id>/<hash>.webp`, or `null` without a logo. */
	logoUrl: string | null;
	/** Active sessions that have signed in to this application. */
	activeSessionCount: number;
	lastAuthorizedAt: IsoDateString | null;
	secretRotatedAt: IsoDateString | null;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
}

export interface ClientListResponse {
	clients: ClientDto[];
}

export interface ClientResponse {
	client: ClientDto;
}

/**
 * Returned exactly once after creating a confidential client or rotating its secret.
 * The plaintext secret is never retrievable again.
 */
export interface ClientWithSecretResponse {
	client: ClientDto;
	clientSecret: string | null;
}

/** An account assigned to an application. */
export interface ClientUserDto {
	id: Snowflake;
	displayName: string;
	email: string;
	role: Role;
	enabled: boolean;
	avatarUrl: string | null;
	assignedAt: IsoDateString;
}

export interface ClientUserListResponse {
	users: ClientUserDto[];
}

/** A session that signed in to a specific application. */
export interface ClientSessionDto {
	sessionId: Snowflake;
	account: {
		id: Snowflake;
		displayName: string;
		email: string;
		avatarUrl: string | null;
	};
	ipAddress: string | null;
	userAgent: string | null;
	firstAuthorizedAt: IsoDateString;
	lastAuthorizedAt: IsoDateString;
	lastSeenAt: IsoDateString;
	expiresAt: IsoDateString;
}

export interface ClientSessionListResponse {
	sessions: ClientSessionDto[];
}
