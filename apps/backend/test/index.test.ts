import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";
import { ConfigError } from "../src/config.js";

const { loadConfig, buildApp, startMaintenance } = vi.hoisted(() => ({
	loadConfig: vi.fn(),
	buildApp: vi.fn(),
	startMaintenance: vi.fn(),
}));

vi.mock(import("../src/config.js"), async (importOriginal) => ({ ...(await importOriginal()), loadConfig }));
vi.mock(import("../src/http/app.js"), () => ({ buildApp }));
vi.mock(import("../src/services/maintenance.js"), () => ({ startMaintenance }));

const CONFIG = { issuer: "https://auth.example.com", version: "1.2.0", host: "0.0.0.0", port: 3000, secureCookies: true, trustProxy: 1 };

/** What `buildApp` returns, reduced to what the entry point uses. */
function server(options: { setUp?: boolean; keyMatches?: boolean } = {}) {
	const { setUp = true, keyMatches = true } = options;
	const stopMaintenance = vi.fn();
	const stopUpdateChecks = vi.fn();
	startMaintenance.mockReturnValue(stopMaintenance);
	const app = {
		log: { fatal: vi.fn(), warn: vi.fn(), info: vi.fn() },
		close: vi.fn(async () => {}),
		listen: vi.fn(async () => ""),
	};
	const services = {
		settings: { get: () => (setUp ? { encryptionKeyCheck: "check" } : null), isSetupComplete: () => setUp },
		keyService: { verifyKeyCheck: vi.fn(() => keyMatches) },
		oidc: { reload: vi.fn(async () => {}) },
		updates: { start: () => stopUpdateChecks },
	};
	buildApp.mockResolvedValue({ app, services });
	return { app, services, stopMaintenance, stopUpdateChecks };
}

const signals = new Map<string, (signal: NodeJS.Signals) => Promise<void>>();
let exit: MockInstance<typeof process.exit>;
let consoleError: MockInstance<typeof console.error>;

/** Runs the entry point once, as `node dist/index.js` does. */
async function start(until: () => void): Promise<void> {
	vi.resetModules();
	await import("../src/index.js");
	await vi.waitFor(until);
}

beforeEach(() => {
	loadConfig.mockReturnValue(CONFIG);
	exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
	consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
	vi.spyOn(process, "once").mockImplementation((event, listener) => {
		signals.set(String(event), listener as (signal: NodeJS.Signals) => Promise<void>);
		return process;
	});
});

afterEach(() => {
	signals.clear();
});

describe("the entry point", () => {
	it("starts a set-up instance and shuts it down once on a signal", async () => {
		const { app, services, stopMaintenance, stopUpdateChecks } = server();

		await start(() => expect(app.log.info).toHaveBeenCalledWith("Aegis 1.2.0 is ready at https://auth.example.com"));

		expect(services.oidc.reload).toHaveBeenCalledOnce();
		expect(app.listen).toHaveBeenCalledWith({ host: "0.0.0.0", port: 3000 });
		expect([...signals.keys()]).toEqual(["SIGINT", "SIGTERM"]);
		expect(app.log.warn).not.toHaveBeenCalled();

		await Promise.all([signals.get("SIGTERM")?.("SIGTERM"), signals.get("SIGINT")?.("SIGINT")]);
		expect(app.log.info).toHaveBeenCalledWith({ signal: "SIGTERM" }, "Shutting down");
		expect(stopMaintenance).toHaveBeenCalledOnce();
		expect(stopUpdateChecks).toHaveBeenCalledOnce();
		expect(app.close).toHaveBeenCalledOnce();
		expect(exit).toHaveBeenCalledExactlyOnceWith(0);
	});

	it("points to the setup of a new instance", async () => {
		const { app } = server({ setUp: false });

		await start(() =>
			expect(app.log.warn).toHaveBeenCalledWith(
				"Setup required: open https://auth.example.com/setup to create the initial admin account.",
			),
		);
	});

	it("refuses to start with another encryption key than the instance was set up with", async () => {
		const { app } = server({ keyMatches: false });

		await start(() => expect(exit).toHaveBeenCalledWith(1));

		expect(app.log.fatal).toHaveBeenCalledWith(expect.stringContaining("AEGIS_ENCRYPTION_KEY does not match"));
		expect(app.close).toHaveBeenCalled();
	});

	it("warns about https without a trusted proxy", async () => {
		loadConfig.mockReturnValue({ ...CONFIG, trustProxy: false });
		const { app } = server();

		await start(() => expect(app.listen).toHaveBeenCalled());

		expect(app.log.warn).toHaveBeenCalledWith(expect.stringContaining("AEGIS_TRUST_PROXY is disabled"));
	});

	it("explains invalid configuration in one line", async () => {
		loadConfig.mockImplementation(() => {
			throw new ConfigError("AEGIS_ISSUER is required");
		});
		buildApp.mockRejectedValue(new Error("not reached"));

		await start(() => expect(exit).toHaveBeenCalled());

		expect(consoleError).toHaveBeenNthCalledWith(1, "[aegis] AEGIS_ISSUER is required");
		expect(exit).toHaveBeenNthCalledWith(1, 1);
	});

	it("reports any other startup failure", async () => {
		const failure = new Error("database unreachable");
		loadConfig.mockImplementation(() => {
			throw failure;
		});

		await start(() => expect(exit).toHaveBeenCalledWith(1));

		expect(consoleError).toHaveBeenCalledWith("[aegis] Fatal error during startup", failure);
	});
});
