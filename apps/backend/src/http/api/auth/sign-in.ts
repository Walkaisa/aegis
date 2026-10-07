import { type SecondFactorPrompt, secondFactorRequestSchema } from "@aegis/contracts";
import type { SessionRecord, UserRecord } from "@aegis/db";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ApiError } from "../../../lib/errors.js";
import { toIso } from "../../../lib/time.js";
import { parseInput } from "../../../lib/validation.js";
import { authenticationMethodsOf, type RequestMeta, type SignInTarget } from "../../../services/auth.js";
import type { AppServices } from "../../../services/container.js";
import type { ChallengeTarget } from "../../../services/second-factor-challenges.js";
import { getSession } from "../../access.js";
import { requestMeta } from "../../request-context.js";
import { toAuthRequestAccount } from "../dto.js";

/*
 * The steps shared by both sign-in routes (administration and authorization requests): after the
 * password, accounts with two-factor authentication get a challenge to answer; everyone else, and
 * those who answered it, get a new session.
 */

const challengeExpired = () =>
	new ApiError(401, "second_factor_expired", "The sign-in has expired or was attempted too often. Sign in again.");

/** Parks a sign-in with a correct password until its second factor is confirmed. */
export function requestSecondFactor(
	services: AppServices,
	reply: FastifyReply,
	user: UserRecord,
	target: ChallengeTarget,
): SecondFactorPrompt {
	const { token, expiresAt } = services.secondFactorChallenges.create(user.id, target);
	services.secondFactorCookie.set(reply, token);
	return {
		type: "second_factor",
		account: toAuthRequestAccount(user),
		methods: ["totp", "recovery_code"],
		expiresAt: toIso(expiresAt),
	};
}

/**
 * Answers the pending challenge of this browser with the submitted code and records the sign-in.
 * A spent or expired challenge sends the user back to the password.
 */
export async function answerSecondFactor(
	services: AppServices,
	request: FastifyRequest,
	reply: FastifyReply,
	challengeTarget: ChallengeTarget,
	signInTarget: SignInTarget,
): Promise<{ user: UserRecord; session: SessionRecord }> {
	const { secondFactorChallenges: challenges, secondFactorCookie: cookie, auth } = services;
	const challenge = challenges.open(cookie.read(request), challengeTarget);
	if (!challenge) {
		cookie.clear(reply);
		throw challengeExpired();
	}

	const input = parseInput(secondFactorRequestSchema, request.body);
	const meta = requestMeta(request);

	let verified: Awaited<ReturnType<typeof auth.verifySecondFactor>>;
	try {
		verified = await auth.verifySecondFactor(challenge.userId, input.code, meta, signInTarget);
	} catch (error) {
		if (error instanceof ApiError && error.code === "second_factor_invalid" && challenges.registerFailure(challenge)) {
			cookie.clear(reply);
			throw challengeExpired();
		}
		throw error;
	}

	challenges.consume(challenge);
	cookie.clear(reply);
	const user = await auth.completeSignIn(verified.user, verified.method, meta, signInTarget);
	const session = await startSession(services, request, reply, user, meta, authenticationMethodsOf(verified.method));
	return { user, session };
}

/** Replaces any previous session of this browser with a new one for the signed-in account. */
export async function startSession(
	services: AppServices,
	request: FastifyRequest,
	reply: FastifyReply,
	user: UserRecord,
	meta: RequestMeta,
	amr = authenticationMethodsOf(null),
): Promise<SessionRecord> {
	// Never reuse a pre-existing session identifier after authentication.
	const previous = await getSession(services, request);
	if (previous) {
		await services.auth.endSession(previous.session.id);
	}

	const { token, session } = await services.auth.createSession(user, meta, { amr });
	services.sessionCookie.set(reply, token, session.expiresAt);
	return session;
}
