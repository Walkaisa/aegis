import { interactionPolicy, type KoaContextWithOIDC } from "oidc-provider";

export const SESSION_REASON = "aegis_session_required";
export const APPLICATION_ACCESS_REASON = "aegis_application_access_required";
export const SECOND_FACTOR_REASON = "aegis_second_factor_required";

type AccountCheck = (ctx: KoaContextWithOIDC, accountId: string) => Promise<boolean>;

/**
 * The default oidc-provider policy plus two sign-in checks:
 * - a provider session is only honoured while the Aegis session of this browser is still valid
 *   (enabled account, not expired, not revoked), so signing out, disabling the account or revoking
 *   the session ends single sign-on immediately;
 * - the account must be allowed to sign in to the requesting application;
 * - an application that asks for a second factor (`acr_values`) gets one from accounts that have it,
 *   even while the session was confirmed with the password only.
 */
export function createInteractionPolicy(checks: {
	isSessionValid: AccountCheck;
	mayUseClient: AccountCheck;
	hasRequiredFactors: AccountCheck;
}) {
	const { base, Check } = interactionPolicy;
	const policy = base();
	const signIn = policy.get("login");
	if (!signIn) {
		throw new Error("The oidc-provider base policy is missing the login prompt");
	}

	const accountCheck = (reason: string, description: string, passes: AccountCheck) =>
		new Check(reason, description, async (ctx) => {
			const accountId = ctx.oidc.session?.accountId;
			if (!accountId) {
				// Already covered by the built-in `no_session` check.
				return Check.NO_NEED_TO_PROMPT;
			}
			return (await passes(ctx, accountId)) ? Check.NO_NEED_TO_PROMPT : Check.REQUEST_PROMPT;
		});

	signIn.checks.add(accountCheck(SESSION_REASON, "End-User authentication is required", checks.isSessionValid), 1);
	signIn.checks.add(accountCheck(APPLICATION_ACCESS_REASON, "End-User may not sign in to this client", checks.mayUseClient), 2);
	signIn.checks.add(accountCheck(SECOND_FACTOR_REASON, "A second factor is required", checks.hasRequiredFactors), 3);

	return policy;
}
