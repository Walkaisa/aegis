import {
	type AuthRequestContextResponse,
	type AuthRequestRedirect,
	type AuthRequestSignInResponse,
	signInRequestSchema,
} from "@aegis/contracts";
import type { OidcClientRecord } from "@aegis/db";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type Provider from "oidc-provider";
import type { InteractionResults } from "oidc-provider";
import { z } from "zod";
import { ApiError, unauthorized } from "../../../lib/errors.js";
import { parseInput } from "../../../lib/validation.js";
import {
	continuationWithSession,
	grantConsent,
	type Interaction,
	interactionParam,
	promptScopes,
	requiresReauthentication,
	signInResult,
} from "../../../oidc/interactions.js";
import type { AuthenticatedSession, SignInTarget } from "../../../services/auth.js";
import { clientReference } from "../../../services/clients.js";
import { isTwoFactorEnabled } from "../../../services/two-factor.js";
import { accountReference } from "../../../services/users.js";
import { access, getSession } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { requestMeta, requireSettings } from "../../request-context.js";
import { toAuthRequestAccount, toAuthRequestClient } from "../dto.js";
import { answerSecondFactor, requestSecondFactor, startSession } from "./sign-in.js";

const challengeParamsSchema = z.object({ challenge: z.string().min(1).max(128) });

const invalidRequest = (message: string) => new ApiError(400, "auth_request_invalid", message);
const accessDenied = () => new ApiError(403, "application_access_denied", "This account may not sign in to the application");

/**
 * `/api/auth/requests/:challenge`: the pending prompt of an OIDC authorization request, rendered by
 * the sign-in and consent pages. Every account may complete it for the applications it has access
 * to; see `ApplicationAccess`.
 */
export async function authRequestRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	/** The request behind the challenge and the enabled application that started it. */
	async function load(request: FastifyRequest, reply: FastifyReply) {
		const { challenge } = parseInput(challengeParamsSchema, request.params);
		const provider = services.oidc.requireProvider();
		const interaction = await provider.interactionDetails(request.raw, reply.raw);

		if (interaction.uid !== challenge) {
			throw invalidRequest("The sign-in request does not match");
		}

		const clientId = interactionParam(interaction, "client_id");
		const client = clientId ? await services.clients.findByClientId(clientId) : null;
		if (!client?.enabled) {
			throw invalidRequest("Unknown application");
		}

		return { provider, interaction, client };
	}

	/** The account that approves a consent: signed in in this browser, owner of the request and allowed to use the application. */
	async function consentingAccount(
		request: FastifyRequest,
		interaction: Interaction,
		client: OidcClientRecord,
	): Promise<AuthenticatedSession> {
		const current = await getSession(services, request);
		if (!current) {
			throw unauthorized();
		}
		if (interaction.prompt.name !== "consent" || interaction.session?.accountId !== current.user.id) {
			throw invalidRequest("No consent is pending for this account");
		}
		if (!(await services.applicationAccess.allows(current.user, client))) {
			throw accessDenied();
		}
		return current;
	}

	/** Completes the prompt; the browser continues the authorization request at the returned URL. */
	async function finish(
		request: FastifyRequest,
		reply: FastifyReply,
		provider: Provider,
		result: InteractionResults,
		mergeWithLastSubmission = false,
	): Promise<AuthRequestRedirect> {
		const redirectTo = await provider.interactionResult(request.raw, reply.raw, result, { mergeWithLastSubmission });
		return { type: "redirect", redirectTo };
	}

	/** The prompt to render, or a redirect when the account signed in in this browser can continue without one. */
	app.get("/", access("public"), async (request, reply): Promise<AuthRequestContextResponse> => {
		const { provider, interaction, client } = await load(request, reply);
		const instanceName = requireSettings(services).instanceName;
		const authRequestClient = toAuthRequestClient(client, interactionParam(interaction, "redirect_uri"));

		if (interaction.prompt.name === "login") {
			const current = await getSession(services, request);
			const allowed = current !== null && (await services.applicationAccess.allows(current.user, client));
			if (current && allowed) {
				const continuation = continuationWithSession(interaction, current);
				if (continuation === "continue") {
					return finish(request, reply, provider, signInResult(current.user.id, current.session));
				}
				if (continuation === "second_factor") {
					// Step-up: already signed in with the password, the application asks for the second factor too.
					return {
						...requestSecondFactor(services, reply, current.user, `oidc:${interaction.uid}`),
						challenge: interaction.uid,
						instanceName,
						client: authRequestClient,
					};
				}
			}

			return {
				type: "sign_in",
				challenge: interaction.uid,
				instanceName,
				client: authRequestClient,
				emailHint: interactionParam(interaction, "login_hint") ?? (allowed ? (current?.user.email ?? null) : null),
				reauthenticationRequired: requiresReauthentication(interaction),
				deniedAccount: current && !allowed ? toAuthRequestAccount(current.user) : null,
				scopes: promptScopes(interaction, client),
				passwordResetEnabled: services.email.isEnabled(),
			};
		}

		if (interaction.prompt.name === "consent") {
			const current = await consentingAccount(request, interaction, client);
			return {
				type: "consent",
				challenge: interaction.uid,
				instanceName,
				client: authRequestClient,
				account: toAuthRequestAccount(current.user),
				scopes: promptScopes(interaction, client),
			};
		}

		throw invalidRequest("Unsupported prompt");
	});

	/**
	 * Answers the sign-in prompt and starts the session of this browser (single sign-on). Accounts with
	 * two-factor authentication receive a challenge instead and continue at `/second-factor`.
	 */
	app.post("/sign-in", access("public", rateLimits.signIn), async (request, reply): Promise<AuthRequestSignInResponse> => {
		const { provider, interaction, client } = await load(request, reply);
		if (interaction.prompt.name !== "login") {
			throw invalidRequest("No sign-in is pending");
		}

		const input = parseInput(signInRequestSchema, request.body);
		const meta = requestMeta(request);
		const target: SignInTarget = { context: "oidc", client };
		const user = await services.auth.verifyPassword(input.email, input.password, meta, target);

		if (isTwoFactorEnabled(user)) {
			return requestSecondFactor(services, reply, user, `oidc:${interaction.uid}`);
		}

		const signedIn = await services.auth.completeSignIn(user, null, meta, target);
		const session = await startSession(services, request, reply, signedIn, meta);
		return finish(request, reply, provider, signInResult(signedIn.id, session));
	});

	/** Confirms the second factor of a pending sign-in, starts the session and continues the request. */
	app.post("/second-factor", access("public", rateLimits.signIn), async (request, reply): Promise<AuthRequestRedirect> => {
		const { provider, interaction, client } = await load(request, reply);
		if (interaction.prompt.name !== "login") {
			throw invalidRequest("No sign-in is pending");
		}

		const target: SignInTarget = { context: "oidc", client };
		const { user, session } = await answerSecondFactor(services, request, reply, `oidc:${interaction.uid}`, target);
		return finish(request, reply, provider, signInResult(user.id, session));
	});

	/** Answers the consent prompt: grants the requested scopes and remembers them for the account. */
	app.post("/consent", access("public"), async (request, reply): Promise<AuthRequestRedirect> => {
		const { provider, interaction, client } = await load(request, reply);
		const current = await consentingAccount(request, interaction, client);

		const { grantId, scopes } = await grantConsent(provider, interaction, current.user.id, client.id);
		await services.consents.merge(current.user.id, client.id, scopes, new Date());
		await services.audit.record({
			type: "oidc.consent.granted",
			actor: accountReference(current.user),
			subject: accountReference(current.user),
			client: clientReference(client),
			meta: requestMeta(request),
			metadata: { scopes },
		});

		return finish(request, reply, provider, { consent: { grantId } }, true);
	});

	/** Cancels the request; the application receives `access_denied`. */
	app.post("/cancel", access("public"), async (request, reply): Promise<AuthRequestRedirect> => {
		const { provider, interaction, client } = await load(request, reply);
		const current = await getSession(services, request);

		await services.audit.record({
			type: "oidc.authorization.cancelled",
			actor: current ? accountReference(current.user) : null,
			subject: current ? accountReference(current.user) : null,
			client: clientReference(client),
			meta: requestMeta(request),
			metadata: { prompt: interaction.prompt.name === "login" ? "sign_in" : interaction.prompt.name },
		});

		return finish(request, reply, provider, { error: "access_denied", error_description: "End-User aborted interaction" });
	});
}
