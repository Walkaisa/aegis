import { type AppConfig, ConfigError, loadConfig } from "./config.js";
import { buildApp } from "./http/app.js";
import { startMaintenance } from "./services/maintenance.js";

function readConfig(): AppConfig {
	try {
		return loadConfig();
	} catch (error) {
		if (error instanceof ConfigError) {
			console.error(`[aegis] ${error.message}`);
			process.exit(1);
		}
		throw error;
	}
}

async function main(): Promise<void> {
	const config = readConfig();
	const { app, services } = await buildApp(config);
	const { log } = app;

	const settings = services.settings.get();
	if (settings && !services.keyService.verifyKeyCheck(settings.encryptionKeyCheck)) {
		log.fatal("AEGIS_ENCRYPTION_KEY does not match the key this instance was set up with. Refusing to start.");
		await app.close();
		process.exit(1);
	}

	if (config.secureCookies && config.trustProxy === false) {
		log.warn(
			"AEGIS_ISSUER uses https but AEGIS_TRUST_PROXY is disabled. Behind a TLS-terminating reverse proxy, set AEGIS_TRUST_PROXY so client IPs and the request protocol are detected correctly.",
		);
	}

	await services.oidc.reload();
	const stopMaintenance = startMaintenance(services, log);

	let shuttingDown = false;
	const shutdown = async (signal: NodeJS.Signals) => {
		if (shuttingDown) {
			return;
		}
		shuttingDown = true;
		log.info({ signal }, "Shutting down");
		stopMaintenance();
		await app.close();
		process.exit(0);
	};
	process.once("SIGINT", shutdown);
	process.once("SIGTERM", shutdown);

	await app.listen({ host: config.host, port: config.port });

	if (services.settings.isSetupComplete()) {
		log.info(`Aegis ${config.version} is ready at ${config.issuer}`);
	} else {
		log.warn(`Setup required: open ${config.issuer}/setup to create the initial admin account.`);
	}
}

main().catch((error: unknown) => {
	console.error("[aegis] Fatal error during startup", error);
	process.exit(1);
});
