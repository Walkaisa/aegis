import {
	type PasswordResetResponse,
	passwordResetSchema,
	type SessionListResponse,
	type SessionRevocationResponse,
	type UserApplicationListResponse,
	type UserResponse,
	userUpdateSchema,
} from "@aegis/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { notFound } from "../../../lib/errors.js";
import { parseInput } from "../../../lib/validation.js";
import type { AppServices } from "../../../services/container.js";
import { access } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { idParam, requestMeta } from "../../request-context.js";
import { toUserApplicationDto, toUserDto } from "../dto.js";
import { imageRoutes } from "../images.js";
import { listSessions } from "../sessions.js";

/** The account with its session count and last-admin state, as most account routes respond. */
export async function userResponse(services: AppServices, id: string): Promise<UserResponse> {
	const user = await services.users.findSummary(id, new Date());
	if (!user) {
		throw notFound("Account");
	}
	return { user: toUserDto(user) };
}

/** `/api/users/:id`: a single account. Last-admin protection is enforced by the user service. */
export async function userRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;
	const respond = (id: string) => userResponse(services, id);

	const findAccount = async (request: FastifyRequest) => {
		const user = await services.users.findById(idParam(request));
		if (!user) {
			throw notFound("Account");
		}
		return user;
	};

	app.get("/", access("users:read"), async (request): Promise<UserResponse> => respond(idParam(request)));

	/** Replaces profile and role. Status, password and picture have routes of their own. */
	app.put("/", access("users:manage"), async (request): Promise<UserResponse> => {
		const id = idParam(request);
		const input = parseInput(userUpdateSchema, request.body);
		await services.userService.update(id, input, request.auth.user, requestMeta(request));
		return respond(id);
	});

	app.delete("/", access("users:manage"), async (request, reply) => {
		await services.userService.delete(idParam(request), request.auth.user, requestMeta(request));
		return reply.code(204).send();
	});

	/** Disabling ends all sessions of the account and invalidates its grants and tokens. */
	const setEnabled = (enabled: boolean) => async (request: FastifyRequest) => {
		const id = idParam(request);
		await services.userService.setEnabled(id, enabled, request.auth.user, requestMeta(request));
		return respond(id);
	};
	app.post("/enable", access("users:manage"), setEnabled(true));
	app.post("/disable", access("users:manage"), setEnabled(false));

	/** Sets a generated or chosen password and ends all sessions of the account. */
	app.post("/password", access("users:manage", rateLimits.sensitive), async (request): Promise<PasswordResetResponse> => {
		const id = idParam(request);
		const input = parseInput(passwordResetSchema, request.body);
		const { generatedPassword } = await services.userService.resetPassword(id, input, request.auth.user, requestMeta(request));
		return { ...(await respond(id)), generatedPassword };
	});

	/** Turns two-factor authentication off for another account, e.g. after a lost device. */
	app.delete("/two-factor", access("users:manage", rateLimits.sensitive), async (request): Promise<UserResponse> => {
		const id = idParam(request);
		await services.twoFactor.reset(id, request.auth.user, requestMeta(request));
		return respond(id);
	});

	/** Every application, with whether the account is assigned to it and may sign in. */
	app.get("/applications", access("applications:read"), async (request): Promise<UserApplicationListResponse> => {
		const applications = await services.applicationAccess.applicationsOf(await findAccount(request));
		return { applications: applications.map(toUserApplicationDto) };
	});

	app.get("/sessions", access("sessions:read"), async (request): Promise<SessionListResponse> => {
		const user = await findAccount(request);
		return listSessions(services, request.auth.session.id, user.id);
	});

	/** Ends all sessions of the account and invalidates its grants and tokens. */
	app.delete("/sessions", access("sessions:manage"), async (request): Promise<SessionRevocationResponse> => {
		const revoked = await services.userService.revokeSessions(idParam(request), request.auth.user, requestMeta(request));
		return { revoked };
	});

	const avatar = imageRoutes({ access: "users:manage", store: services.avatarService, ownerOf: idParam, respond });
	await app.register(avatar, { prefix: "/avatar" });
}
