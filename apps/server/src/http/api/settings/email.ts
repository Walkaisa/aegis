import { type EmailSettingsDto, type EmailTestResponse, emailSettingsSchema, emailTestSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { parseInput } from "../../../lib/validation.js";
import { accountReference } from "../../../services/users.js";
import { access } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { requestLocale, requestMeta, requireSettings } from "../../request-context.js";
import { toEmailSettingsDto } from "../dto.js";

/**
 * `/api/settings/email`: the SMTP server Aegis sends through. Saving with sending turned on
 * verifies the connection first, and `/test` runs the same check against the unsaved form — both
 * fail with `smtp_connection_failed` and the server's own reply as the message.
 */
export async function emailSettingsRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;
	const respond = (): EmailSettingsDto => toEmailSettingsDto(services.emailSettings.get(), requireSettings(services).instanceName);

	app.get("/", access("settings:read"), async (): Promise<EmailSettingsDto> => respond());

	app.put("/", access("settings:manage", rateLimits.sensitive), async (request): Promise<EmailSettingsDto> => {
		const input = parseInput(emailSettingsSchema, request.body);
		await services.email.save(input, accountReference(request.auth.user), requestMeta(request));
		return respond();
	});

	/**
	 * Tries the settings currently in the form: `verify` only opens a session, `send` also delivers
	 * a test message to the admin running the test.
	 */
	app.post("/test", access("settings:manage", rateLimits.strict), async (request): Promise<EmailTestResponse> => {
		const input = parseInput(emailTestSchema, request.body);
		return services.email.test(input, request.auth.user, requestLocale(request), requestMeta(request));
	});
}
