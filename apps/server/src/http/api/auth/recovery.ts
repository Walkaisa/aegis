import {
	type EmailChangeConfirmResponse,
	forgotPasswordSchema,
	type PasswordResetTokenDto,
	passwordResetConfirmSchema,
	verificationLinkSchema,
} from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { ApiError } from "../../../lib/errors.js";
import { parseInput } from "../../../lib/validation.js";
import { access } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { requestLocale, requestMeta } from "../../request-context.js";

const disabled = () => new ApiError(409, "email_not_configured", "This instance cannot send e-mail, so passwords cannot be reset by link");

/**
 * `/api/auth/password-reset` and `/api/auth/email-change`: the two flows that are completed from a
 * link in a mailbox. They are public on purpose — the link may be opened in a browser that has
 * never signed in, and the token is the only thing that authorises the request.
 */
export async function recoveryRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	/**
	 * Asks for a reset link. Always answers 202 right away, whether or not the address belongs to an
	 * account: neither the response nor the time it takes may reveal who has one here.
	 */
	app.post("/password-reset", access("public", rateLimits.signIn), async (request, reply) => {
		if (!services.email.isEnabled()) {
			throw disabled();
		}
		const input = parseInput(forgotPasswordSchema, request.body);
		services.recovery
			.requestPasswordReset(input.email, requestLocale(request), requestMeta(request))
			.catch((error: unknown) => request.log.error({ err: error }, "Handling a password reset request failed"));
		return reply.code(202).send();
	});

	/** Whose account a reset link belongs to, so the page can show it before a password is typed. */
	app.post("/password-reset/validate", access("public", rateLimits.sensitive), async (request): Promise<PasswordResetTokenDto> => {
		const input = parseInput(verificationLinkSchema, request.body);
		return services.recovery.validatePasswordReset(input.token);
	});

	/** Redeems the link and sets the new password. Every session of the account ends. */
	app.post("/password-reset/confirm", access("public", rateLimits.sensitive), async (request, reply) => {
		const input = parseInput(passwordResetConfirmSchema, request.body);
		await services.recovery.completePasswordReset(input.token, input.password, requestLocale(request), requestMeta(request));
		return reply.code(204).send();
	});

	/** Confirms a new e-mail address from the mailbox it was requested for. */
	app.post("/email-change/confirm", access("public", rateLimits.sensitive), async (request): Promise<EmailChangeConfirmResponse> => {
		const input = parseInput(verificationLinkSchema, request.body);
		return services.recovery.confirmEmailChange(input.token, requestMeta(request));
	});
}
