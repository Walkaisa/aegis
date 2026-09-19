import { type ClientResponse, type ClientWithSecretResponse, clientUpdateSchemaFor } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { parseInput } from "../../../lib/validation.js";
import { access } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { idParam, requestMeta } from "../../request-context.js";
import { toClientDto } from "../dto.js";
import { imageRoutes } from "../images.js";
import { applicationSessionsRoutes } from "./sessions.js";
import { applicationUsersRoutes } from "./users.js";

/** `/api/applications/:id`: a single application, its secret, logo, assigned accounts and sessions. */
export async function applicationRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;
	const respond = async (id: string): Promise<ClientResponse> => ({ client: toClientDto(await services.clientService.find(id)) });

	app.get("/", access("applications:read"), async (request): Promise<ClientResponse> => respond(idParam(request)));

	/**
	 * Replaces the settings. The client type cannot change; accounts that lose access, because the
	 * application is disabled or restricted, lose their sign-ins, grants and tokens.
	 */
	app.put("/", access("applications:manage"), async (request): Promise<ClientResponse> => {
		const existing = await services.clientService.find(idParam(request));
		const input = parseInput(clientUpdateSchemaFor(existing.clientType), request.body);
		await services.clientService.update(existing, input, request.auth.user, requestMeta(request));
		return respond(existing.id);
	});

	app.delete("/", access("applications:manage"), async (request, reply) => {
		const existing = await services.clientService.find(idParam(request));
		await services.clientService.delete(existing, request.auth.user, requestMeta(request));
		return reply.code(204).send();
	});

	/** Rotates the client secret. The plaintext secret is part of this response only. */
	app.post("/secret", access("applications:manage", rateLimits.sensitive), async (request): Promise<ClientWithSecretResponse> => {
		const existing = await services.clientService.find(idParam(request));
		const clientSecret = await services.clientService.rotateSecret(existing, request.auth.user, requestMeta(request));
		return { ...(await respond(existing.id)), clientSecret };
	});

	const logo = imageRoutes({ access: "applications:manage", store: services.clientLogoService, ownerOf: idParam, respond });
	await app.register(logo, { prefix: "/logo" });
	await app.register(applicationUsersRoutes, { prefix: "/users" });
	await app.register(applicationSessionsRoutes, { prefix: "/sessions" });
}
