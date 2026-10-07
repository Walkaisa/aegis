import {
	type AccountResponse,
	passwordChangeSchema,
	profileUpdateSchema,
	type RecoveryCodesResponse,
	type TwoFactorSetupResponse,
	type TwoFactorStatusResponse,
	twoFactorConfirmSchema,
	twoFactorEnableSchema,
	twoFactorSetupSchema,
} from "@aegis/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { notFound } from "../../lib/errors.js";
import { parseInput } from "../../lib/validation.js";
import { access } from "../access.js";
import { rateLimits } from "../rate-limits.js";
import { requestLocale, requestMeta } from "../request-context.js";
import { toUserDto } from "./dto.js";
import { imageRoutes } from "./images.js";

/**
 * `/api/account`: profile, password, two-factor authentication and profile picture of the
 * signed-in account.
 *
 * While an e-mail server is configured, a new address is confirmed from that address before it
 * takes effect; the pending change is part of every response here and is finished by the public
 * route in `auth/recovery.ts`.
 */
export async function accountRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	const respond = async (id: string): Promise<AccountResponse> => {
		const account = await services.users.findSummary(id, new Date());
		if (!account) {
			throw notFound("Account");
		}
		return { account: toUserDto(account), pendingEmailChange: await services.recovery.pendingEmailChange(id) };
	};

	app.get("/", access("console:access"), async (request): Promise<AccountResponse> => respond(request.auth.user.id));

	/**
	 * Replaces display name and e-mail address; a new e-mail address requires the current password.
	 * With an e-mail server configured it is only applied once the new address confirms it.
	 */
	app.put("/", access("console:access", rateLimits.sensitive), async (request): Promise<AccountResponse> => {
		const input = parseInput(profileUpdateSchema, request.body);
		const updated = await services.userService.updateOwnProfile(request.auth.user, input, requestLocale(request), requestMeta(request));
		return respond(updated.id);
	});

	/** Drops a pending e-mail change; the account keeps the address it signs in with. */
	app.delete("/email-change", access("console:access"), async (request): Promise<AccountResponse> => {
		await services.recovery.cancelEmailChange(request.auth.user, requestMeta(request));
		return respond(request.auth.user.id);
	});

	/** Sends the confirmation link again, to the same address, with a fresh token. */
	app.post("/email-change/resend", access("console:access", rateLimits.sensitive), async (request): Promise<AccountResponse> => {
		await services.recovery.resendEmailChange(request.auth.user, requestLocale(request), requestMeta(request));
		return respond(request.auth.user.id);
	});

	/** Changes the password, ends all other sessions of the account and tells its owner by e-mail. */
	app.post("/password", access("console:access", rateLimits.sensitive), async (request, reply) => {
		const { auth } = request;
		const input = parseInput(passwordChangeSchema, request.body);
		await services.userService.changeOwnPassword(auth.user, auth.session.id, input, requestLocale(request), requestMeta(request));
		return reply.code(204).send();
	});

	/** Whether two-factor authentication is on and how many recovery codes are left. */
	app.get(
		"/two-factor",
		access("console:access"),
		async (request): Promise<TwoFactorStatusResponse> => ({
			twoFactor: await services.twoFactor.status(request.auth.user),
		}),
	);

	/** Starts the setup with the current password and returns the secret for the authenticator app. */
	app.post("/two-factor/setup", access("console:access", rateLimits.sensitive), async (request): Promise<TwoFactorSetupResponse> => {
		const input = parseInput(twoFactorSetupSchema, request.body);
		return services.twoFactor.beginSetup(request.auth.user, input.currentPassword);
	});

	/** Discards an unconfirmed setup. */
	app.delete("/two-factor/setup", access("console:access"), async (request, reply) => {
		await services.twoFactor.cancelSetup(request.auth.user);
		return reply.code(204).send();
	});

	/** Confirms the setup with a first code; returns the recovery codes and ends the other sessions. */
	app.post("/two-factor", access("console:access", rateLimits.sensitive), async (request): Promise<RecoveryCodesResponse> => {
		const { auth } = request;
		const input = parseInput(twoFactorEnableSchema, request.body);
		return services.twoFactor.enable(auth.user, input.code, input.label ?? null, auth.session.id, requestMeta(request));
	});

	/** Turns two-factor authentication off; requires the password and a code. */
	app.post("/two-factor/disable", access("console:access", rateLimits.sensitive), async (request): Promise<TwoFactorStatusResponse> => {
		const input = parseInput(twoFactorConfirmSchema, request.body);
		const twoFactor = await services.twoFactor.disable(request.auth.user, input.currentPassword, input.code, requestMeta(request));
		return { twoFactor };
	});

	/** Replaces the recovery codes; requires the password and a code. */
	app.post(
		"/two-factor/recovery-codes",
		access("console:access", rateLimits.sensitive),
		async (request): Promise<RecoveryCodesResponse> => {
			const input = parseInput(twoFactorConfirmSchema, request.body);
			return services.twoFactor.regenerateRecoveryCodes(request.auth.user, input.currentPassword, input.code, requestMeta(request));
		},
	);

	// The profile picture belongs to the signed-in account.
	const ownerOf = (request: FastifyRequest) => request.auth.user.id;
	await app.register(imageRoutes({ access: "console:access", store: services.avatarService, ownerOf, respond }), { prefix: "/avatar" });
}
