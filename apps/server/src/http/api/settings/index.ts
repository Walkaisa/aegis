import { type InstanceSettingsDto, instanceSettingsUpdateSchema } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { DAY_MS, SECOND_MS } from "../../../lib/time.js";
import { parseInput } from "../../../lib/validation.js";
import { accountReference } from "../../../services/users.js";
import { access } from "../../access.js";
import { requestMeta, requireSettings } from "../../request-context.js";
import { toInstanceSettingsDto } from "../dto.js";
import { emailSettingsRoutes } from "./email.js";
import { keysRoutes } from "./keys.js";

/**
 * `/api/settings`: settings of the instance. Its signing keys live below `/keys` (`keys.ts`) and
 * the e-mail server below `/email` (`email.ts`).
 */
export async function settingsRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;
	const respond = (): InstanceSettingsDto => toInstanceSettingsDto(requireSettings(services), services.config.issuer);

	app.get("/", access("settings:read"), async (): Promise<InstanceSettingsDto> => respond());

	/** Changes any subset of the settings, e.g. only the audit retention. */
	app.patch("/", access("settings:manage"), async (request): Promise<InstanceSettingsDto> => {
		const current = requireSettings(services);
		const input = parseInput(instanceSettingsUpdateSchema, request.body);
		const sessionTtlSeconds =
			input.sessionTtlDays === undefined ? current.sessionTtlSeconds : (input.sessionTtlDays * DAY_MS) / SECOND_MS;

		await services.settings.update(
			{
				instanceName: input.instanceName ?? current.instanceName,
				sessionTtlSeconds,
				auditRetentionDays: input.auditRetentionDays ?? current.auditRetentionDays,
			},
			new Date(),
		);
		// Session lifetimes are part of the provider configuration.
		if (sessionTtlSeconds !== current.sessionTtlSeconds) {
			await services.oidc.reload();
		}

		const settings = respond();
		await services.audit.record({
			type: "settings.updated",
			actor: accountReference(request.auth.user),
			meta: requestMeta(request),
			metadata: {
				instanceName: settings.instanceName,
				sessionTtlDays: settings.sessionTtlDays,
				auditRetentionDays: settings.auditRetentionDays,
			},
		});
		return settings;
	});

	await app.register(keysRoutes, { prefix: "/keys" });
	await app.register(emailSettingsRoutes, { prefix: "/email" });
}
