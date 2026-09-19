import type { SessionListResponse, SessionRevocationResponse } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { notFound } from "../../lib/errors.js";
import type { AppServices } from "../../services/container.js";
import { accountReference } from "../../services/users.js";
import { access } from "../access.js";
import { idParam, requestMeta } from "../request-context.js";
import { toSessionDto } from "./dto.js";

/** Active sessions with the applications each of them signed in to; of all accounts or of one. */
export async function listSessions(services: AppServices, currentSessionId: string, userId?: string): Promise<SessionListResponse> {
	const now = new Date();
	const [sessions, applications] = await Promise.all([
		services.sessions.listActive(now, userId),
		services.sessions.listActiveApplications(now, userId),
	]);

	const applicationsBySession = Map.groupBy(applications, (application) => application.sessionId);
	return {
		sessions: sessions.map((row) => toSessionDto(row, applicationsBySession.get(row.session.id) ?? [], currentSessionId)),
	};
}

/** `/api/sessions`: the sessions of all accounts. Those of one account: `/api/users/:id/sessions`. */
export async function sessionsRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	app.get("/", access("sessions:read"), async (request): Promise<SessionListResponse> => listSessions(services, request.auth.session.id));

	/** Ends the sessions of all accounts, the own one included; this browser is signed out as well. */
	app.delete("/", access("sessions:manage"), async (request, reply): Promise<SessionRevocationResponse> => {
		const revoked = await services.revoker.revokeAll();
		await services.audit.record({
			type: "session.all_revoked",
			actor: accountReference(request.auth.user),
			meta: requestMeta(request),
			metadata: { sessions: revoked },
		});
		services.sessionCookie.clear(reply);
		return { revoked };
	});

	/** Ends a session. Ending the own session signs out of this browser. */
	app.delete("/:id", access("sessions:manage"), async (request, reply) => {
		const id = idParam(request);
		const session = await services.sessions.findById(id);
		const owner = session ? await services.users.findById(session.userId) : null;
		if (!session || !owner || !(await services.auth.endSession(id))) {
			throw notFound("Session");
		}

		const current = id === request.auth.session.id;
		await services.audit.record({
			type: "session.revoked",
			actor: accountReference(request.auth.user),
			subject: accountReference(owner),
			meta: requestMeta(request),
			metadata: { sessions: 1, role: owner.role, current },
		});

		if (current) {
			services.sessionCookie.clear(reply);
		}
		return reply.code(204).send();
	});
}
