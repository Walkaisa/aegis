import type { SecurityOverviewDto } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { RETIRED_KEY_RETENTION_DAYS } from "../../../services/keys.js";
import { accountReference } from "../../../services/users.js";
import { access } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";
import { requestMeta } from "../../request-context.js";
import { toSigningKeyDto } from "../dto.js";

/** `/api/settings/keys`: the signing keys of the provider, next to the password hashing parameters. */
export async function keysRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	const respond = async (): Promise<SecurityOverviewDto> => ({
		signingKeys: (await services.keys.listSigningKeys()).map(toSigningKeyDto),
		retiredKeyRetentionDays: RETIRED_KEY_RETENTION_DAYS,
		argon2: { ...services.passwords.settings },
	});

	app.get("/", access("settings:read"), async (): Promise<SecurityOverviewDto> => respond());

	/** Signs with a new key from now on. The previous key stays published for a while, so tokens it signed still verify. */
	app.post("/rotate", access("settings:manage", rateLimits.strict), async (request): Promise<SecurityOverviewDto> => {
		const key = await services.keyService.rotateSigningKey(new Date());
		await services.oidc.reload();

		await services.audit.record({
			type: "signing_key.rotated",
			actor: accountReference(request.auth.user),
			meta: requestMeta(request),
			metadata: { kid: key.kid },
		});
		return respond();
	});
}
