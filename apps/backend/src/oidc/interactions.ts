import { ACR_VALUES, normalizeEmail, SUPPORTED_SCOPES, type SupportedScope } from "@aegis/contracts";
import type { OidcClientRecord, SessionRecord } from "@aegis/db";
import type Provider from "oidc-provider";
import type { InteractionResults } from "oidc-provider";
import { toEpochSeconds } from "../lib/time.js";
import { type AuthenticatedSession, acrOf } from "../services/auth.js";
import { isTwoFactorEnabled } from "../services/two-factor.js";

/** A pending authorization request; its `uid` is the challenge the sign-in and consent pages carry. */
export type Interaction = Awaited<ReturnType<Provider["interactionDetails"]>>;

/** Reasons for which an existing user session must not be reused silently. */
const FORCED_SIGN_IN_REASONS = new Set(["login_prompt", "id_token_hint", "claims_id_token_sub_value", "essential_acr", "essential_acrs"]);

/** A non-empty string parameter of the authorization request. */
export function interactionParam(interaction: Interaction, name: string): string | null {
	const value = interaction.params[name];
	return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Completes the sign-in prompt for an account with the authentication of its session; applications
 * receive it as the `amr` and `acr` claims.
 */
export function signInResult(accountId: string, session: Pick<SessionRecord, "authenticatedAt" | "amr">): InteractionResults {
	return {
		login: { accountId, ts: toEpochSeconds(session.authenticatedAt), amr: session.amr, acr: acrOf(session.amr), remember: true },
	};
}

/** True when the application asks for a sign-in with a second factor through `acr_values`. */
export function requestsSecondFactor(acrValues: unknown): boolean {
	return typeof acrValues === "string" && acrValues.split(" ").includes(ACR_VALUES.mfa);
}

/** True when the application demanded a fresh authentication (`prompt=login`, `max_age`). */
export function requiresReauthentication(interaction: Interaction): boolean {
	return interaction.prompt.reasons.some((reason) => reason === "login_prompt" || reason === "max_age");
}

/** True when the session was confirmed with a second factor the application asked for and the account has. */
export function needsSecondFactor(acrValues: unknown, current: AuthenticatedSession): boolean {
	return requestsSecondFactor(acrValues) && !current.session.amr.includes("mfa") && isTwoFactorEnabled(current.user);
}

/**
 * How a signed-in user answers a sign-in prompt: without entering anything again (`continue`), by
 * confirming only the second factor the application asked for (`second_factor`), or by signing in
 * anew when the application demanded a fresh or specific authentication (`sign_in`).
 */
export function continuationWithSession(interaction: Interaction, current: AuthenticatedSession): "continue" | "second_factor" | "sign_in" {
	const { reasons } = interaction.prompt;
	if (reasons.some((reason) => FORCED_SIGN_IN_REASONS.has(reason))) {
		return "sign_in";
	}

	if (reasons.includes("max_age")) {
		const maxAge = Number(interaction.params.max_age);
		if (!Number.isFinite(maxAge) || Date.now() - current.session.authenticatedAt.getTime() > maxAge * 1000) {
			return "sign_in";
		}
	}

	const emailHint = interactionParam(interaction, "login_hint");
	if (emailHint && normalizeEmail(emailHint) !== current.user.emailNormalized) {
		return "sign_in";
	}

	return needsSecondFactor(interaction.params.acr_values, current) ? "second_factor" : "continue";
}

/**
 * The scopes a prompt shows: requested by the application (for a consent, only those still missing),
 * supported by Aegis and allowed for the application.
 */
export function promptScopes(interaction: Interaction, client: OidcClientRecord): SupportedScope[] {
	const details = interaction.prompt.details as { missingOIDCScope?: unknown };
	const requested =
		interaction.prompt.name === "consent" && Array.isArray(details.missingOIDCScope)
			? details.missingOIDCScope.filter((scope): scope is string => typeof scope === "string")
			: (interactionParam(interaction, "scope") ?? "").split(" ");

	return SUPPORTED_SCOPES.filter((scope) => requested.includes(scope) && client.allowedScopes.includes(scope));
}

/**
 * Grants everything the consent prompt is missing, on top of the grant the request already has.
 * Returns the grant and all OIDC scopes it covers now.
 */
export async function grantConsent(
	provider: Provider,
	interaction: Interaction,
	accountId: string,
	clientId: string,
): Promise<{ grantId: string; scopes: string[] }> {
	const details = interaction.prompt.details as {
		missingOIDCScope?: string[];
		missingOIDCClaims?: string[];
		missingResourceScopes?: Record<string, string[]>;
	};

	const existing = interaction.grantId ? await provider.Grant.find(interaction.grantId) : undefined;
	const grant = existing ?? new provider.Grant({ accountId, clientId });

	if (details.missingOIDCScope) {
		grant.addOIDCScope(details.missingOIDCScope.join(" "));
	}
	if (details.missingOIDCClaims) {
		grant.addOIDCClaims(details.missingOIDCClaims);
	}
	if (details.missingResourceScopes) {
		for (const [indicator, scopes] of Object.entries(details.missingResourceScopes)) {
			grant.addResourceScope(indicator, scopes.join(" "));
		}
	}

	const grantId = await grant.save();
	return { grantId, scopes: grant.getOIDCScope().split(" ").filter(Boolean) };
}
