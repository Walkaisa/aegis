import { type AdminSignInResponse, type AuthSessionResponse, signInRequestSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { notFound } from "../../../lib/errors.js";
import { parseInput } from "../../../lib/validation.js";
import type { AuthenticatedSession, SignInTarget } from "../../../services/auth.js";
import { isTwoFactorEnabled } from "../../../services/two-factor.js";
import { access, getSession } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { requestMeta, requireSettings } from "../../request-context.js";
import { toAuthSessionResponse } from "../dto.js";
import { answerSecondFactor, requestSecondFactor, startSession } from "./sign-in.js";

const ADMIN: SignInTarget = { context: "admin" };

/** `/api/auth/session`: the session of this browser. Signing in here requires `console:access`. */
export async function authSessionRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	const respond = async (auth: AuthenticatedSession): Promise<AuthSessionResponse> => {
		const account = await services.users.findSummary(auth.user.id, new Date());
		if (!account) {
			throw notFound("Account");
		}
		return toAuthSessionResponse(account, auth.session, requireSettings(services).instanceName);
	};

	/** The signed-in account and what it may do. */
	app.get("/", access("authenticated"), async (request): Promise<AuthSessionResponse> => respond(request.auth));

	/**
	 * Signs in to the administration and starts a new session. Accounts with two-factor authentication
	 * receive a challenge instead (202) and complete the sign-in at `/second-factor`.
	 */
	app.post("/", access("public", rateLimits.signIn), async (request, reply): Promise<AdminSignInResponse> => {
		requireSettings(services);
		const input = parseInput(signInRequestSchema, request.body);
		const meta = requestMeta(request);
		const user = await services.auth.verifyPassword(input.email, input.password, meta, ADMIN);

		if (isTwoFactorEnabled(user)) {
			return reply.code(202).send(requestSecondFactor(services, reply, user, "admin"));
		}

		const signedIn = await services.auth.completeSignIn(user, null, meta, ADMIN);
		const session = await startSession(services, request, reply, signedIn, meta);
		return reply.code(201).send({ type: "signed_in", ...(await respond({ user: signedIn, session })) });
	});

	/** Confirms the second factor of a pending sign-in and starts the session. */
	app.post("/second-factor", access("public", rateLimits.signIn), async (request, reply): Promise<AdminSignInResponse> => {
		requireSettings(services);
		const { user, session } = await answerSecondFactor(services, request, reply, "admin", ADMIN);
		return reply.code(201).send({ type: "signed_in", ...(await respond({ user, session })) });
	});

	/** Signs out of the administration and all applications that rely on this session. Succeeds without a session as well. */
	app.delete("/", access("public"), async (request, reply) => {
		const current = await getSession(services, request);
		if (current) {
			await services.auth.signOut(current, requestMeta(request));
		}
		services.sessionCookie.clear(reply);
		return reply.code(204).send();
	});
}
