import type { FastifyBaseLogger } from "fastify";
import { DAY_MS, MINUTE_MS } from "../lib/time.js";
import type { AppServices } from "./container.js";

const INTERVAL_MS = 15 * MINUTE_MS;

/** Periodically removes expired data. Returns a function that stops the timer. */
export function startMaintenance(services: AppServices, log: FastifyBaseLogger): () => void {
	let running = false;

	const run = async () => {
		if (running) {
			return;
		}
		running = true;
		try {
			const now = new Date();
			const sessions = await services.sessions.deleteExpired(now);
			const oidcArtifacts = await services.oidcArtifacts.deleteExpired(now);
			const retentionDays = services.settings.get()?.auditRetentionDays ?? services.config.auditRetentionDays;
			const auditEvents = await services.audit.deleteOlderThan(new Date(now.getTime() - retentionDays * DAY_MS));
			const signingKeys = await services.keyService.pruneRetiredKeys(now);
			const accountTokens = await services.accountTokens.deleteExpired(now);
			services.throttle.sweep(now.getTime());

			if (signingKeys > 0) {
				await services.oidc.reload();
			}
			if (sessions + oidcArtifacts + auditEvents + signingKeys + accountTokens > 0) {
				log.debug({ sessions, oidcArtifacts, auditEvents, signingKeys, accountTokens }, "Removed expired data");
			}
		} catch (error) {
			log.error({ err: error }, "Maintenance run failed");
		} finally {
			running = false;
		}
	};

	void run();
	const timer = setInterval(() => void run(), INTERVAL_MS);
	timer.unref();
	return () => clearInterval(timer);
}
