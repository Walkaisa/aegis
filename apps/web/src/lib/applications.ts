import { type ClientDto, classifyRedirectUri } from "@aegis/contracts";
import { Globe, type LucideIcon, Server, Smartphone } from "lucide-react";

/**
 * How an application is presented in the UI. Aegis stores only the client type and redirect
 * URIs; the kind is derived from them, like the application types of Auth0 or Okta.
 */
export type ApplicationKind = "web" | "spa" | "native";

export const APPLICATION_KINDS: readonly ApplicationKind[] = ["web", "spa", "native"];

export const KIND_ICONS: Record<ApplicationKind, LucideIcon> = {
	web: Server,
	spa: Globe,
	native: Smartphone,
};

export function isApplicationKind(value: unknown): value is ApplicationKind {
	return typeof value === "string" && (APPLICATION_KINDS as readonly string[]).includes(value);
}

export function applicationKindOf(client: Pick<ClientDto, "type" | "redirectUris">): ApplicationKind {
	if (client.type === "confidential") {
		return "web";
	}
	const native = client.redirectUris.some((uri) => {
		const result = classifyRedirectUri(uri);
		return result.ok && result.kind === "custom_scheme";
	});
	return native ? "native" : "spa";
}

export type IntegrationId = "authjs" | "oauth2-proxy" | "oidc-client-ts" | "appauth" | "generic";

export interface Integration {
	id: IntegrationId;
	/** Product name; `null` for the translated "other library" entry. */
	name: string | null;
	kinds: readonly ApplicationKind[];
	/** Appended to the application URL to suggest the redirect URI. */
	callbackPath: string;
	/** Appended to the application URL to suggest the post sign-out redirect URI. */
	signOutPath: string;
}

export const INTEGRATIONS: readonly Integration[] = [
	{ id: "authjs", name: "Next.js · Auth.js", kinds: ["web"], callbackPath: "/api/auth/callback/aegis", signOutPath: "/" },
	{ id: "oauth2-proxy", name: "oauth2-proxy", kinds: ["web"], callbackPath: "/oauth2/callback", signOutPath: "/" },
	{ id: "oidc-client-ts", name: "oidc-client-ts", kinds: ["spa"], callbackPath: "/callback", signOutPath: "/" },
	{ id: "appauth", name: "AppAuth", kinds: ["native"], callbackPath: "", signOutPath: "" },
	{ id: "generic", name: null, kinds: ["web", "spa", "native"], callbackPath: "/auth/callback", signOutPath: "/" },
];

export function integrationsFor(kind: ApplicationKind): Integration[] {
	return INTEGRATIONS.filter((integration) => integration.kinds.includes(kind));
}

/** Joins an application URL and a path; `/` yields the bare application URL. */
export function joinUrl(baseUrl: string, path: string): string {
	const base = baseUrl.trim().replace(/\/+$/, "");
	if (!base || !path) {
		return "";
	}
	return path === "/" ? base : `${base}${path}`;
}

export const SECRET_PLACEHOLDER = "your-client-secret";

export interface SnippetContext {
	issuer: string;
	/** The public OAuth `client_id`. */
	clientId: string;
	/** The real secret right after creation, a placeholder later, `null` for public clients. */
	clientSecret: string | null;
	redirectUri: string;
	postSignOutRedirectUri: string | null;
	scopes: readonly string[];
}

export interface Snippet {
	file: string;
	code: string;
}

const DEFAULT_SCOPES = "openid profile email";

const lines = (entries: (string | null)[]) => entries.filter((entry): entry is string => entry !== null).join("\n");

export function buildSnippets(id: IntegrationId, context: SnippetContext): Snippet[] {
	const { issuer, clientId, clientSecret, redirectUri, postSignOutRedirectUri } = context;
	const scopes = context.scopes.join(" ");

	switch (id) {
		case "authjs":
			return [
				{
					file: ".env.local",
					code: lines([
						"# openssl rand -base64 32",
						"AUTH_SECRET=",
						`AUTH_AEGIS_ISSUER=${issuer}`,
						`AUTH_AEGIS_ID=${clientId}`,
						clientSecret === null ? null : `AUTH_AEGIS_SECRET=${clientSecret}`,
					]),
				},
				{
					file: "auth.ts",
					code: lines([
						'import NextAuth from "next-auth";',
						"",
						"export const { handlers, auth, signIn, signOut } = NextAuth({",
						scopes === DEFAULT_SCOPES
							? '  providers: [{ id: "aegis", name: "Aegis", type: "oidc" }],'
							: `  providers: [{ id: "aegis", name: "Aegis", type: "oidc", authorization: { params: { scope: "${scopes}" } } }],`,
						"});",
					]),
				},
				{
					file: "app/api/auth/[...nextauth]/route.ts",
					code: lines(['import { handlers } from "@/auth";', "", "export const { GET, POST } = handlers;"]),
				},
			];
		case "oauth2-proxy":
			return [
				{
					file: "oauth2-proxy.cfg",
					code: lines([
						'provider = "oidc"',
						`oidc_issuer_url = "${issuer}"`,
						`client_id = "${clientId}"`,
						clientSecret === null ? null : `client_secret = "${clientSecret}"`,
						`redirect_url = "${redirectUri}"`,
						'code_challenge_method = "S256"',
						`scope = "${scopes}"`,
						'email_domains = ["*"]',
						"# openssl rand -base64 32 | head -c 32",
						'cookie_secret = ""',
					]),
				},
			];
		case "oidc-client-ts":
			return [
				{
					file: "auth.ts",
					code: lines([
						'import { UserManager } from "oidc-client-ts";',
						"",
						"export const userManager = new UserManager({",
						`  authority: "${issuer}",`,
						`  client_id: "${clientId}",`,
						`  redirect_uri: "${redirectUri}",`,
						postSignOutRedirectUri ? `  post_logout_redirect_uri: "${postSignOutRedirectUri}",` : null,
						`  scope: "${scopes}",`,
						"});",
					]),
				},
			];
		case "appauth":
			return [
				{
					file: "AppAuth",
					code: lines([
						`Issuer        ${issuer}`,
						`Client ID     ${clientId}`,
						`Redirect URI  ${redirectUri}`,
						`Scopes        ${scopes}`,
						"PKCE          S256",
					]),
				},
			];
		case "generic":
			return [
				{
					file: ".env",
					code: lines([
						`OIDC_ISSUER=${issuer}`,
						`OIDC_CLIENT_ID=${clientId}`,
						clientSecret === null ? null : `OIDC_CLIENT_SECRET=${clientSecret}`,
						`OIDC_REDIRECT_URI=${redirectUri}`,
						`OIDC_SCOPES="${scopes}"`,
					]),
				},
			];
	}
}
