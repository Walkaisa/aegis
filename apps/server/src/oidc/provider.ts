import type { IncomingMessage } from "node:http";
import { ACR_VALUES, avatarUrl, hasPermission, SUPPORTED_SCOPES } from "@aegis/contracts";
import type { OidcClientRecord, UserRecord } from "@aegis/db";
import type { FastifyBaseLogger } from "fastify";
import Provider, { type Configuration, type errors, type Grant, type KoaContextWithOIDC } from "oidc-provider";
import type { AppConfig } from "../config.js";
import type { Encryptor } from "../crypto/encryption.js";
import type { SessionCookie } from "../http/session-cookie.js";
import { SECOND_MS, toEpochSeconds } from "../lib/time.js";
import type { AuditLog } from "../repositories/audit.js";
import type { ClientRepository } from "../repositories/clients.js";
import type { ConsentRepository } from "../repositories/consents.js";
import type { OidcArtifactRepository } from "../repositories/oidc-artifacts.js";
import type { SessionRepository } from "../repositories/sessions.js";
import type { SettingsRepository } from "../repositories/settings.js";
import type { UserRepository } from "../repositories/users.js";
import type { ApplicationAccess } from "../services/application-access.js";
import type { AuthService } from "../services/auth.js";
import type { KeyService } from "../services/keys.js";
import { getSessionPolicy } from "../services/session-policy.js";
import { accountReference } from "../services/users.js";
import { createAdapterFactory } from "./adapter.js";
import { applicationTypeFor, isPkceRequired, PKCE_POLICY_METADATA } from "./client-metadata.js";
import { needsSecondFactor } from "./interactions.js";
import { renderSignOutPage } from "./pages.js";
import { createInteractionPolicy } from "./policy.js";

export const OIDC_PATH_PREFIX = "/oauth2";
export const JWKS_PATH = "/.well-known/jwks.json";

/** Pages of the web UI that render the pending prompt of an authorization request. */
const PROMPT_PAGES: Record<string, string> = { login: "/sign-in", consent: "/consent" };

export const OIDC_COOKIE_NAMES = {
	session: "aegis_oidc_session",
	interaction: "aegis_interaction",
	resume: "aegis_interaction_resume",
} as const;

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
const ID_TOKEN_TTL_SECONDS = 60 * 60;
const AUTHORIZATION_CODE_TTL_SECONDS = 60;
const INTERACTION_TTL_SECONDS = 30 * 60;

const SUPPORTED_SCOPE_SET: ReadonlySet<string> = new Set(SUPPORTED_SCOPES);

export interface OidcDependencies {
	config: AppConfig;
	settings: SettingsRepository;
	users: UserRepository;
	clients: ClientRepository;
	consents: ConsentRepository;
	sessions: SessionRepository;
	oidcArtifacts: OidcArtifactRepository;
	keyService: KeyService;
	encryptor: Encryptor;
	audit: AuditLog;
	auth: AuthService;
	applicationAccess: ApplicationAccess;
	sessionCookie: SessionCookie;
	log: FastifyBaseLogger;
}

/** Fastify stores the client IP (resolved according to AEGIS_TRUST_PROXY) on the raw request. */
export interface AegisIncomingMessage extends IncomingMessage {
	aegisClientIp?: string;
}

/** Enabled accounts whose role may sign in to applications are OIDC subjects. */
function isOidcSubject(user: UserRecord | null): user is UserRecord {
	return user?.enabled === true && hasPermission(user.role, "applications:sign_in");
}

function requestMetaOf(ctx: KoaContextWithOIDC) {
	const userAgent = ctx.get("user-agent");
	return {
		ip: (ctx.req as AegisIncomingMessage).aegisClientIp ?? null,
		userAgent: userAgent ? userAgent.slice(0, 512) : null,
	};
}

function sessionTokenOf(ctx: KoaContextWithOIDC, deps: OidcDependencies): string | undefined {
	return ctx.cookies.get(deps.sessionCookie.name, { signed: false });
}

function errorDetails(error: errors.OIDCProviderError | Error) {
	const oidcError = error as Partial<errors.OIDCProviderError>;
	return {
		error: oidcError.error ?? error.name,
		description: oidcError.error_description ?? null,
	};
}

const clientReference = (client: OidcClientRecord | null) => (client ? { id: client.id, label: client.name } : null);

/** Provider events are synchronous; bookkeeping runs afterwards without delaying the response. */
function inBackground(deps: OidcDependencies, message: string, task: () => Promise<unknown>): void {
	task().catch((error: unknown) => deps.log.error({ err: error }, message));
}

/**
 * Loads the grant for the current authorization request. Besides the session-bound grant that
 * oidc-provider tracks itself, Aegis re-creates grants from stored consent and grants trusted
 * (skip-consent) web applications automatically. Scopes are limited to the application's
 * allowed scopes.
 */
async function loadExistingGrant(ctx: KoaContextWithOIDC, deps: OidcDependencies): Promise<Grant | undefined> {
	const { oidc } = ctx;
	const client = oidc.client;
	const accountId = oidc.session?.accountId;
	if (!client || !oidc.session || !accountId) {
		return undefined;
	}

	const grantId = (oidc.result?.consent?.grantId as string | undefined) ?? oidc.session.grantIdFor(client.clientId);
	if (grantId) {
		const grant = await oidc.provider.Grant.find(grantId);
		if (grant && grant.accountId === accountId && grant.clientId === client.clientId) {
			return grant;
		}
	}

	const [application, user] = await Promise.all([deps.clients.findByClientId(client.clientId), deps.users.findById(accountId)]);
	if (!application || !isOidcSubject(user) || !(await deps.applicationAccess.allows(user, application))) {
		return undefined;
	}

	const requested = [...oidc.requestParamScopes].filter(
		(scope) => SUPPORTED_SCOPE_SET.has(scope) && application.allowedScopes.includes(scope),
	);
	const trusted = application.skipConsent && applicationTypeFor(application) === "web";
	const consented = trusted ? requested : ((await deps.consents.find(user.id, application.id)) ?? []);
	const approved = requested.filter((scope) => consented.includes(scope));

	if (approved.length === 0) {
		return undefined;
	}

	const grant = new oidc.provider.Grant({ accountId, clientId: client.clientId });
	grant.addOIDCScope(approved.join(" "));
	await grant.save();

	if (trusted) {
		await deps.consents.merge(user.id, application.id, approved, new Date());
	}

	return grant;
}

function registerProviderEvents(provider: Provider, deps: OidcDependencies): void {
	provider.on("authorization.success", (ctx: KoaContextWithOIDC) => {
		const publicClientId = ctx.oidc.client?.clientId ?? null;
		const accountId = ctx.oidc.session?.accountId ?? null;
		const token = sessionTokenOf(ctx, deps);
		const meta = requestMetaOf(ctx);

		inBackground(deps, "Failed to record an application sign-in", async () => {
			const now = new Date();
			const [client, current] = await Promise.all([
				publicClientId ? deps.clients.findByClientId(publicClientId) : null,
				deps.auth.resolveSession(token),
			]);

			if (client) {
				if (current) {
					await deps.sessions.recordApplication(current.session.id, client.id, now);
				}
				await deps.clients.touchAuthorized(client.id, now);
			}

			const user = current?.user ?? (accountId ? await deps.users.findById(accountId) : null);
			await deps.audit.record({
				type: "oidc.authorization.succeeded",
				actor: user ? accountReference(user) : null,
				subject: user ? accountReference(user) : null,
				client: clientReference(client),
				meta,
			});
		});
	});

	provider.on("authorization.error", (ctx: KoaContextWithOIDC, error: errors.OIDCProviderError) => {
		const params = ctx.oidc?.params ?? {};
		const publicClientId = ctx.oidc?.client?.clientId ?? (typeof params.client_id === "string" ? params.client_id : null);
		const meta = requestMetaOf(ctx);
		const metadata = {
			...errorDetails(error),
			clientId: publicClientId,
			redirectUri: typeof params.redirect_uri === "string" ? params.redirect_uri : null,
		};

		inBackground(deps, "Failed to record an authorization error", async () => {
			const client = publicClientId ? await deps.clients.findByClientId(publicClientId) : null;
			await deps.audit.record({ type: "oidc.authorization.failed", client: clientReference(client), meta, metadata });
		});
	});

	provider.on("grant.error", (ctx: KoaContextWithOIDC, error: errors.OIDCProviderError) => {
		const params = ctx.oidc?.params ?? {};
		const publicClientId = ctx.oidc?.client?.clientId ?? null;
		const meta = requestMetaOf(ctx);
		const metadata = {
			...errorDetails(error),
			grantType: typeof params.grant_type === "string" ? params.grant_type : null,
		};

		inBackground(deps, "Failed to record a token error", async () => {
			const client = publicClientId ? await deps.clients.findByClientId(publicClientId) : null;
			await deps.audit.record({ type: "oidc.token.failed", client: clientReference(client), meta, metadata });
		});
	});

	provider.on("end_session.success", (ctx: KoaContextWithOIDC) => {
		const token = sessionTokenOf(ctx, deps);
		const publicClientId = ctx.oidc.client?.clientId ?? null;
		const meta = requestMetaOf(ctx);
		// The confirmation page offers "stay signed in"; only a confirmed sign-out ends the user session.
		const signedOut = Boolean(ctx.oidc.params?.logout);

		if (signedOut) {
			ctx.append("Set-Cookie", deps.sessionCookie.clearHeaderValue());
		}

		inBackground(deps, "Failed to process a sign-out", async () => {
			const [client, current] = await Promise.all([
				publicClientId ? deps.clients.findByClientId(publicClientId) : null,
				deps.auth.resolveSession(token),
			]);

			if (signedOut) {
				if (current) {
					await deps.auth.endSession(current.session.id);
				}
				await deps.audit.record({
					type: "oidc.sign_out",
					actor: current ? accountReference(current.user) : null,
					subject: current ? accountReference(current.user) : null,
					client: clientReference(client),
					meta,
				});
			} else if (current && client) {
				await deps.sessions.deleteApplication(current.session.id, client.id);
			}
		});
	});

	provider.on("server_error", (ctx: KoaContextWithOIDC, error: Error) => {
		deps.log.error({ err: error, path: ctx.path }, "OpenID provider error");
	});
}

export async function createProvider(deps: OidcDependencies): Promise<Provider> {
	const settings = deps.settings.get();
	if (!settings) {
		throw new Error("The OpenID provider cannot be created before the initial setup");
	}

	const [jwks, cookieKeys] = await Promise.all([deps.keyService.loadSigningJwks(), deps.keyService.loadCookieKeys()]);
	const sessionTtlSeconds = getSessionPolicy("user", settings.sessionTtlSeconds).ttlMs / SECOND_MS;

	const isSessionValid = async (ctx: KoaContextWithOIDC, accountId: string) =>
		(await deps.auth.resolveSession(sessionTokenOf(ctx, deps)))?.user.id === accountId;

	const hasRequiredFactors = async (ctx: KoaContextWithOIDC, accountId: string) => {
		const current = await deps.auth.resolveSession(sessionTokenOf(ctx, deps));
		return current?.user.id !== accountId || !needsSecondFactor(ctx.oidc.params?.acr_values, current);
	};

	const mayUseClient = async (ctx: KoaContextWithOIDC, accountId: string) => {
		const publicClientId = ctx.oidc.client?.clientId;
		const [client, user] = await Promise.all([
			publicClientId ? deps.clients.findByClientId(publicClientId) : null,
			deps.users.findById(accountId),
		]);
		if (client && user && (await deps.applicationAccess.allows(user, client))) {
			return true;
		}

		const meta = requestMetaOf(ctx);
		inBackground(deps, "Failed to record a denied authorization", () =>
			deps.audit.record({
				type: "oidc.authorization.denied",
				actor: user ? accountReference(user) : null,
				subject: user ? accountReference(user) : null,
				client: clientReference(client),
				meta,
			}),
		);
		return false;
	};

	const configuration: Configuration = {
		adapter: createAdapterFactory(deps),
		clients: [],

		findAccount: async (_ctx, sub) => {
			const user = await deps.users.findById(sub);
			if (!isOidcSubject(user)) {
				return undefined;
			}
			const picture = avatarUrl(user.id, user.avatarHash);
			return {
				// The subject is always the account id, never the e-mail address.
				accountId: user.id,
				claims: async () => ({
					sub: user.id,
					email: user.email,
					email_verified: user.emailVerified,
					name: user.displayName,
					// Absolute, so applications can load it directly; omitted without a profile picture.
					...(picture ? { picture: `${deps.config.issuer}${picture}` } : {}),
					updated_at: toEpochSeconds(user.updatedAt),
				}),
			};
		},

		claims: {
			openid: ["sub"],
			email: ["email", "email_verified"],
			profile: ["name", "picture", "updated_at"],
		},
		scopes: [...SUPPORTED_SCOPES],
		// `acr` tells applications whether a second factor was used; see `acrOf`.
		acrValues: [ACR_VALUES.password, ACR_VALUES.mfa],
		responseTypes: ["code"],
		// oidc-provider supports S256 only, so `plain` is always rejected; the application decides whether
		// PKCE is required (see `isPkceRequired`). A code bound to a challenge always needs its verifier.
		pkce: {
			required: (_ctx, client) => isPkceRequired(client),
		},
		extraClientMetadata: {
			properties: [PKCE_POLICY_METADATA],
		},
		clientDefaults: {
			grant_types: ["authorization_code"],
			response_types: ["code"],
			id_token_signed_response_alg: "RS256",
			token_endpoint_auth_method: "client_secret_basic",
		},
		clientBasedCORS: (ctx, origin, client) => {
			if (origin === "null") {
				return false;
			}
			if (ctx.oidc.route !== "userinfo" && client.clientAuthMethod !== "none") {
				return false;
			}
			return (client.redirectUris ?? []).some((uri) => URL.parse(uri)?.origin === origin);
		},
		// Include scope-derived claims (email, name) in the ID token; most relying parties expect them there.
		conformIdTokenClaims: false,
		// Every authorization request must repeat an exactly registered redirect_uri.
		allowOmittingSingleRegisteredRedirectUri: false,

		cookies: {
			names: { ...OIDC_COOKIE_NAMES },
			keys: cookieKeys,
			long: { httpOnly: true, sameSite: "lax" },
			// The prompt pages carry the request in `?challenge=`, so the interaction cookie must not be
			// scoped to the page path. The resume cookie keeps its own path (set by oidc-provider).
			short: { httpOnly: true, sameSite: "lax", path: "/" },
		},

		features: {
			devInteractions: { enabled: false },
			rpInitiatedLogout: {
				enabled: true,
				logoutSource: async (ctx, form) => {
					renderSignOutPage(ctx, form, deps.settings.get()?.instanceName ?? "Aegis");
				},
				postLogoutSuccessSource: async (ctx) => {
					ctx.redirect("/signed-out");
				},
			},
			userinfo: { enabled: true },
			revocation: { enabled: true },
			introspection: { enabled: false },
			registration: { enabled: false },
			clientCredentials: { enabled: false },
			deviceFlow: { enabled: false },
			backchannelLogout: { enabled: false },
			claimsParameter: { enabled: false },
			pushedAuthorizationRequests: { enabled: false },
			resourceIndicators: { enabled: false },
		},

		interactions: {
			policy: createInteractionPolicy({ isSessionValid, mayUseClient, hasRequiredFactors }),
			url: async (_ctx, interaction) => {
				const page = PROMPT_PAGES[interaction.prompt.name] ?? PROMPT_PAGES.login;
				return `${page}?${new URLSearchParams({ challenge: interaction.uid })}`;
			},
		},

		issueRefreshToken: async () => false,
		jwks: jwks as Configuration["jwks"],
		loadExistingGrant: (ctx) => loadExistingGrant(ctx, deps),

		renderError: async (ctx, out) => {
			const params = new URLSearchParams({ error: String(out.error) });
			if (out.error_description) {
				params.set("error_description", String(out.error_description));
			}
			ctx.redirect(`/error?${params.toString()}`);
		},

		routes: {
			authorization: `${OIDC_PATH_PREFIX}/authorize`,
			token: `${OIDC_PATH_PREFIX}/token`,
			userinfo: `${OIDC_PATH_PREFIX}/userinfo`,
			jwks: JWKS_PATH,
			end_session: `${OIDC_PATH_PREFIX}/sign-out`,
			revocation: `${OIDC_PATH_PREFIX}/revoke`,
			introspection: `${OIDC_PATH_PREFIX}/introspect`,
			pushed_authorization_request: `${OIDC_PATH_PREFIX}/par`,
			registration: `${OIDC_PATH_PREFIX}/register`,
			code_verification: `${OIDC_PATH_PREFIX}/device`,
			device_authorization: `${OIDC_PATH_PREFIX}/device/authorize`,
			backchannel_authentication: `${OIDC_PATH_PREFIX}/bc-authorize`,
		},

		ttl: {
			AccessToken: ACCESS_TOKEN_TTL_SECONDS,
			AuthorizationCode: AUTHORIZATION_CODE_TTL_SECONDS,
			IdToken: ID_TOKEN_TTL_SECONDS,
			Interaction: INTERACTION_TTL_SECONDS,
			Session: sessionTtlSeconds,
			Grant: sessionTtlSeconds,
		},
	};

	const provider = new Provider(deps.config.issuer, configuration);
	provider.proxy = deps.config.trustProxy !== false;
	registerProviderEvents(provider, deps);
	return provider;
}
