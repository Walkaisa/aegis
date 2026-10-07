import { type UserListResponse, userCreateSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { parseInput } from "../../../lib/validation.js";
import { access } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { requestMeta } from "../../request-context.js";
import { toUserDto } from "../dto.js";
import { userResponse, userRoutes } from "./user.js";

/** `/api/users`: accounts of every role. A single account lives below `/:id` (`user.ts`). */
export async function usersRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	app.get("/", access("users:read"), async (): Promise<UserListResponse> => {
		const users = await services.users.list(new Date());
		return { users: users.map(toUserDto) };
	});

	app.post("/", access("users:manage", rateLimits.sensitive), async (request, reply) => {
		const input = parseInput(userCreateSchema, request.body);
		const user = await services.userService.create(input, request.auth.user, requestMeta(request));
		return reply.code(201).send(await userResponse(services, user.id));
	});

	await app.register(userRoutes, { prefix: "/:id" });
}
