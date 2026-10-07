import { ACR_VALUES } from "@aegis/contracts";
import { describe, expect } from "vitest";
import { ISSUER, test } from "../../support/aegis.js";

describe("discovery", () => {
	test("publishes the endpoints and capabilities of Aegis", async ({ aegis }) => {
		await aegis.setup();

		const response = await aegis.client().get("/.well-known/openid-configuration");

		expect(response.statusCode).toBe(200);
		expect(response.json()).toMatchObject({
			issuer: ISSUER,
			authorization_endpoint: `${ISSUER}/oauth2/authorize`,
			token_endpoint: `${ISSUER}/oauth2/token`,
			userinfo_endpoint: `${ISSUER}/oauth2/userinfo`,
			end_session_endpoint: `${ISSUER}/oauth2/sign-out`,
			revocation_endpoint: `${ISSUER}/oauth2/revoke`,
			jwks_uri: `${ISSUER}/.well-known/jwks.json`,
			response_types_supported: ["code"],
			grant_types_supported: ["authorization_code"],
			code_challenge_methods_supported: ["S256"],
			scopes_supported: ["openid", "profile", "email"],
			acr_values_supported: [ACR_VALUES.password, ACR_VALUES.mfa],
			id_token_signing_alg_values_supported: ["RS256"],
			claims_supported: expect.arrayContaining(["sub", "email", "name", "picture", "acr", "amr", "auth_time"]),
		});
		for (const disabled of [
			"registration_endpoint",
			"introspection_endpoint",
			"device_authorization_endpoint",
			"pushed_authorization_request_endpoint",
		]) {
			expect(response.json()).not.toHaveProperty(disabled);
		}
	});

	test("publishes the public part of the signing key only", async ({ aegis }) => {
		await aegis.setup();
		const [active] = await aegis.services.keys.listSigningKeys();

		const { keys } = (await aegis.client().get("/.well-known/jwks.json")).json() as { keys: Record<string, unknown>[] };

		expect(keys).toEqual([expect.objectContaining({ kty: "RSA", kid: active?.kid, alg: "RS256", use: "sig" })]);
		for (const key of keys) {
			for (const secret of ["d", "p", "q", "dp", "dq", "qi"]) {
				expect(key).not.toHaveProperty(secret);
			}
		}
	});

	test("is unavailable until the initial setup is complete", async ({ aegis }) => {
		const response = await aegis.client().get("/.well-known/openid-configuration");

		expect(response.statusCode).toBe(503);
		expect(response.json().error.code).toBe("setup_required");
	});
});
