import type { OidcClientRecord, SessionRecord, UserRecord } from "@aegis/db";
import { describe, expect } from "vitest";
import {
	continuationWithSession,
	grantConsent,
	type Interaction,
	promptScopes,
	requestsSecondFactor,
} from "../../src/oidc/interactions.js";
import type { AuthenticatedSession } from "../../src/services/auth.js";
import { test } from "../support/aegis.js";

interface InteractionOptions {
	name?: string;
	reasons?: string[];
	details?: Record<string, unknown>;
	params?: Record<string, unknown>;
	grantId?: string;
}

/** A pending request as `provider.interactionDetails` returns it, with what these functions read. */
function interaction({ name = "login", reasons = [], details = {}, params = {}, grantId }: InteractionOptions): Interaction {
	return { uid: "uid", prompt: { name, reasons, details }, params, grantId } as Interaction;
}

function signedIn(authenticatedAgoMs: number): AuthenticatedSession {
	const user = { emailNormalized: "ada@aegis.test", totpEnabledAt: null, totpSecret: null } as UserRecord;
	const session = { authenticatedAt: new Date(Date.now() - authenticatedAgoMs), amr: ["pwd"] } as SessionRecord;
	return { user, session };
}

describe("continuationWithSession", () => {
	test("reuses a session only while it is younger than max_age", () => {
		const maxAge = (value: string) => interaction({ reasons: ["max_age"], params: { max_age: value } });

		expect(continuationWithSession(maxAge("3600"), signedIn(1_000))).toBe("continue");
		expect(continuationWithSession(maxAge("1"), signedIn(5_000))).toBe("sign_in");
		expect(continuationWithSession(maxAge("not a number"), signedIn(0))).toBe("sign_in");
	});

	test("never reuses a session silently when the application demands a sign-in", () => {
		for (const reason of ["login_prompt", "id_token_hint", "essential_acr"]) {
			expect(continuationWithSession(interaction({ reasons: [reason] }), signedIn(0))).toBe("sign_in");
		}
	});
});

describe("promptScopes", () => {
	const client = { allowedScopes: ["openid", "email"] } as OidcClientRecord;

	test("shows what a consent is missing, as far as the application may ask for it", () => {
		const consent = interaction({ name: "consent", details: { missingOIDCScope: ["email", "profile", 42] } });

		expect(promptScopes(consent, client)).toEqual(["email"]);
	});

	test("falls back to the requested scopes", () => {
		const consent = interaction({ name: "consent", params: { scope: "openid email profile" } });

		expect(promptScopes(consent, client)).toEqual(["openid", "email"]);
		expect(promptScopes(interaction({}), client)).toEqual([]);
	});
});

describe("requestsSecondFactor", () => {
	test("reads the mfa class from acr_values", () => {
		expect(requestsSecondFactor("urn:aegis:acr:password urn:aegis:acr:mfa")).toBe(true);
		expect(requestsSecondFactor("urn:aegis:acr:password")).toBe(false);
		expect(requestsSecondFactor(["urn:aegis:acr:mfa"])).toBe(false);
	});
});

describe("grantConsent", () => {
	test("adds what is missing to the grant the request already has", async ({ aegis }) => {
		await aegis.setup();
		const provider = aegis.services.oidc.requireProvider();
		const existing = new provider.Grant({ accountId: "1", clientId: "2" });
		existing.addOIDCScope("openid");
		const grantId = await existing.save();

		const result = await grantConsent(
			provider,
			interaction({
				name: "consent",
				grantId,
				details: {
					missingOIDCScope: ["email"],
					missingOIDCClaims: ["email_verified"],
					missingResourceScopes: { "https://api.aegis.test": ["read"] },
				},
			}),
			"1",
			"2",
		);

		expect(result).toEqual({ grantId, scopes: ["openid", "email"] });
		const saved = await provider.Grant.find(grantId);
		expect(saved?.getOIDCClaims()).toEqual(["email_verified"]);
		expect(saved?.getResourceScope("https://api.aegis.test")).toBe("read");
	});

	test("starts a new grant when the request has none", async ({ aegis }) => {
		await aegis.setup();
		const provider = aegis.services.oidc.requireProvider();

		const result = await grantConsent(provider, interaction({ name: "consent" }), "1", "2");

		expect(result.scopes).toEqual([]);
		expect((await provider.Grant.find(result.grantId))?.accountId).toBe("1");
	});
});
