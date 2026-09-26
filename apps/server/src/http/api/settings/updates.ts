import type { VersionStatusDto } from "@aegis/contracts";
import type { FastifyInstance } from "fastify";
import { access } from "../../access.js";
import { rateLimits } from "../../rate-limits.js";

/** `/api/settings/updates`: the running version and whether a newer release is out. */
export async function updatesRoutes(app: FastifyInstance): Promise<void> {
	const { services } = app;

	/** The result of the last check; Aegis checks on its own in the background. */
	app.get("/", access("settings:read"), async (): Promise<VersionStatusDto> => services.updates.status());

	/** Asks GitHub right away instead of waiting for the next scheduled check. */
	app.post("/check", access("settings:manage", rateLimits.strict), async (): Promise<VersionStatusDto> => services.updates.check());
}
