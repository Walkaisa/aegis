import { type ClientUserListResponse, idParamSchema, snowflakeSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { parseInput } from "../../../lib/validation.js";
import { access } from "../../access.js";
import { idParam, requestMeta } from "../../request-context.js";
import { toClientUserDto } from "../dto.js";

const userParamsSchema = idParamSchema.extend({ userId: snowflakeSchema });

/**
 * `/api/applications/:id/users`: the accounts assigned to the application. They decide who may sign
 * in while its access policy is `assigned`; admins may always sign in.
 */
export async function applicationUsersRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	app.get("/", access("applications:read"), async (request): Promise<ClientUserListResponse> => {
		const client = await services.clientService.find(idParam(request));
		const rows = await services.clientAssignments.listUsers(client.id);
		return { users: rows.map(toClientUserDto) };
	});

	/** Assigns the account. Assigning it again changes nothing. */
	app.put("/:userId", access("applications:manage"), async (request, reply) => {
		const { id, userId } = parseInput(userParamsSchema, request.params);
		const client = await services.clientService.find(id);
		await services.clientService.assign(client, userId, request.auth.user, requestMeta(request));
		return reply.code(204).send();
	});

	/** Removes the assignment; if the account loses access, its sign-ins, grants and tokens for the application end. */
	app.delete("/:userId", access("applications:manage"), async (request, reply) => {
		const { id, userId } = parseInput(userParamsSchema, request.params);
		const client = await services.clientService.find(id);
		await services.clientService.unassign(client, userId, request.auth.user, requestMeta(request));
		return reply.code(204).send();
	});
}
