import { type ClientSessionListResponse, idParamSchema, snowflakeSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { parseInput } from "../../../lib/validation.js";
import { access } from "../../access.js";
import { idParam, requestMeta } from "../../request-context.js";
import { toClientSessionDto } from "../dto.js";

const sessionParamsSchema = idParamSchema.extend({ sessionId: snowflakeSchema });

/** `/api/applications/:id/sessions`: the sessions signed in to the application. */
export async function applicationSessionsRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	app.get("/", access("sessions:read"), async (request): Promise<ClientSessionListResponse> => {
		const client = await services.clientService.find(idParam(request));
		const rows = await services.sessions.listByClient(client.id, new Date());
		return { sessions: rows.map(toClientSessionDto) };
	});

	/** Revokes all grants and tokens of the application; every account must authorize it again. */
	app.delete("/", access("sessions:manage"), async (request, reply) => {
		const client = await services.clientService.find(idParam(request));
		await services.clientService.revokeSessions(client, request.auth.user, requestMeta(request));
		return reply.code(204).send();
	});

	/** Ends the sign-in of a single session; its account must authorize the application again. */
	app.delete("/:sessionId", access("sessions:manage"), async (request, reply) => {
		const { id, sessionId } = parseInput(sessionParamsSchema, request.params);
		const client = await services.clientService.find(id);
		await services.clientService.revokeSession(client, sessionId, request.auth.user, requestMeta(request));
		return reply.code(204).send();
	});
}
