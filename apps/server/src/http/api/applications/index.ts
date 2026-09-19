import { type ClientListResponse, type ClientWithSecretResponse, clientCreateSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { parseInput } from "../../../lib/validation.js";
import { access } from "../../access.js";
import { requestMeta } from "../../request-context.js";
import { toClientDto } from "../dto.js";
import { applicationRoutes } from "./application.js";

/** `/api/applications`: applications (OIDC clients). A single application lives below `/:id` (`application.ts`). */
export async function applicationsRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	app.get("/", access("applications:read"), async (): Promise<ClientListResponse> => {
		const clients = await services.clients.list(new Date());
		return { clients: clients.map(toClientDto) };
	});

	app.post("/", access("applications:manage"), async (request, reply) => {
		const input = parseInput(clientCreateSchema, request.body);
		const { client, secret } = await services.clientService.create(input, request.auth.user, requestMeta(request));

		// The plaintext secret is part of this response only and never retrievable again.
		const body: ClientWithSecretResponse = { client: toClientDto(await services.clientService.find(client.id)), clientSecret: secret };
		return reply.code(201).send(body);
	});

	await app.register(applicationRoutes, { prefix: "/:id" });
}
