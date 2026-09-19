import { classifyRedirectUri, type PkcePolicy } from "@aegis/contracts";
import type { OidcClientRecord } from "@aegis/db";
import type { AdapterPayload, Client } from "oidc-provider";
import type { Encryptor } from "../crypto/encryption.js";

/** Aegis-specific client metadata that tells `pkce.required` how the client uses PKCE. */
export const PKCE_POLICY_METADATA = "pkce_policy";

/**
 * Whether an authorization request of the client must carry a `code_challenge`; `pkce.required` of
 * oidc-provider. Only confidential clients may go without PKCE, and only if their policy says so:
 * public clients (`token_endpoint_auth_method=none`) and any unexpected value fail closed.
 *
 * A `code_challenge` that is sent anyway is always bound to the code and verified at the token
 * endpoint by oidc-provider (S256 only), whatever the policy.
 */
export function isPkceRequired(client: Client): boolean {
	if (client.clientAuthMethod === "none") {
		return true;
	}
	const policy = client.metadata()[PKCE_POLICY_METADATA] as PkcePolicy | undefined;
	return policy !== "optional" && policy !== "disabled";
}

/** Encryption context of a client secret, bound to the internal application id. */
export const clientSecretContext = (id: string) => `client_secret:${id}`;

/**
 * Public clients that register private-use URI scheme redirects are native apps. oidc-provider
 * treats native clients more strictly (e.g. consent can never be skipped silently).
 */
export function applicationTypeFor(client: Pick<OidcClientRecord, "clientType" | "redirectUris">): "web" | "native" {
	if (client.clientType !== "public") {
		return "web";
	}
	const usesCustomScheme = client.redirectUris.some((uri) => {
		const result = classifyRedirectUri(uri);
		return result.ok && result.kind === "custom_scheme";
	});
	return usesCustomScheme ? "native" : "web";
}

/**
 * Maps an Aegis application to oidc-provider client metadata. Only the authorization code flow
 * is ever enabled; redirect URIs are matched exactly and `scope` limits the requestable scopes.
 */
export function toClientMetadata(client: OidcClientRecord, encryptor: Encryptor): AdapterPayload {
	const metadata: AdapterPayload = {
		client_id: client.id,
		client_name: client.name,
		application_type: applicationTypeFor(client),
		redirect_uris: client.redirectUris,
		post_logout_redirect_uris: client.postLogoutRedirectUris,
		grant_types: ["authorization_code"],
		response_types: ["code"],
		token_endpoint_auth_method: client.tokenEndpointAuthMethod,
		id_token_signed_response_alg: "RS256",
		scope: client.allowedScopes.join(" "),
		[PKCE_POLICY_METADATA]: client.pkcePolicy,
	};

	if (client.clientType === "confidential" && client.clientSecretCiphertext) {
		metadata.client_secret = encryptor.decryptString(client.clientSecretCiphertext, clientSecretContext(client.id));
	}

	return metadata;
}
