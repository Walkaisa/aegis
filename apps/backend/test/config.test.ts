import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "../src/config.js";
import { AEGIS_VERSION } from "../src/version.js";

const key = randomBytes(32);
const required = {
	AEGIS_ISSUER: "https://auth.example.com",
	AEGIS_ENCRYPTION_KEY: key.toString("base64"),
	AEGIS_DATABASE_URL: "postgres://aegis:secret@db:5432/aegis",
};

function errorOf(env: Record<string, string | undefined>): string {
	try {
		loadConfig(env);
	} catch (error) {
		expect(error).toBeInstanceOf(ConfigError);
		return (error as ConfigError).message;
	}
	throw new Error("expected loadConfig to fail");
}

describe("loadConfig", () => {
	it("applies the documented defaults", () => {
		const config = loadConfig(required);

		expect(config).toMatchObject({
			env: "development",
			isProduction: false,
			version: AEGIS_VERSION,
			issuer: "https://auth.example.com",
			issuerOrigin: "https://auth.example.com",
			secureCookies: true,
			databaseUrl: required.AEGIS_DATABASE_URL,
			host: "0.0.0.0",
			port: 3000,
			trustProxy: false,
			logLevel: "info",
			argon2: { memoryKiB: 65_536, iterations: 3, parallelism: 4 },
			auditRetentionDays: 180,
			updateCheck: true,
		});
		expect(config.encryptionKey.equals(key)).toBe(true);
		expect(config.frontendDir).toBe(fileURLToPath(new URL("../../frontend/", import.meta.url)));
	});

	it("reads every option", () => {
		const config = loadConfig({
			...required,
			NODE_ENV: "production",
			AEGIS_ISSUER: " https://auth.example.com/ ",
			AEGIS_HOST: "127.0.0.1",
			AEGIS_PORT: "8080",
			AEGIS_LOG_LEVEL: "warn",
			AEGIS_ARGON2_MEMORY_KIB: "19456",
			AEGIS_ARGON2_ITERATIONS: "2",
			AEGIS_ARGON2_PARALLELISM: "1",
			AEGIS_AUDIT_RETENTION_DAYS: "30",
			AEGIS_UPDATE_CHECK: "false",
		});

		expect(config).toMatchObject({
			env: "production",
			isProduction: true,
			issuer: "https://auth.example.com",
			host: "127.0.0.1",
			port: 8080,
			logLevel: "warn",
			argon2: { memoryKiB: 19_456, iterations: 2, parallelism: 1 },
			auditRetentionDays: 30,
			updateCheck: false,
		});
	});

	it("treats the test environment like development", () => {
		expect(loadConfig({ ...required, NODE_ENV: "test" }).env).toBe("development");
	});

	it("uses plain cookies for http issuers, which are only allowed for local hosts in production", () => {
		for (const host of ["localhost", "127.0.0.1", "[::1]"]) {
			const config = loadConfig({ ...required, NODE_ENV: "production", AEGIS_ISSUER: `http://${host}:3000` });
			expect(config.secureCookies).toBe(false);
		}
		expect(loadConfig({ ...required, AEGIS_ISSUER: "http://aegis.lan" }).secureCookies).toBe(false);
		expect(errorOf({ ...required, NODE_ENV: "production", AEGIS_ISSUER: "http://aegis.lan" })).toMatch(/https in production/);
	});

	it.each([
		["not a url", /absolute URL/],
		["ftp://auth.example.com", /must use https/],
		["https://auth.example.com?x=1", /query or a fragment/],
		["https://auth.example.com#x", /query or a fragment/],
		["https://user:pw@auth.example.com", /credentials/],
		["https://auth.example.com/aegis", /without a path/],
	])("rejects the issuer %s", (issuer, message) => {
		expect(errorOf({ ...required, AEGIS_ISSUER: issuer })).toMatch(message);
	});

	it("rejects anything but a PostgreSQL URL", () => {
		expect(loadConfig({ ...required, AEGIS_DATABASE_URL: "postgresql://db/aegis" }).databaseUrl).toBe("postgresql://db/aegis");
		expect(errorOf({ ...required, AEGIS_DATABASE_URL: "mysql://db/aegis" })).toMatch(/PostgreSQL connection URL/);
		expect(errorOf({ ...required, AEGIS_DATABASE_URL: "db:5432" })).toMatch(/PostgreSQL connection URL/);
	});

	it("rejects an encryption key that is not 32 bytes", () => {
		expect(errorOf({ ...required, AEGIS_ENCRYPTION_KEY: "too-short" })).toMatch(/exactly 32 bytes/);
	});

	it("lists every missing or invalid variable", () => {
		const message = errorOf({ AEGIS_PORT: "99999", AEGIS_LOG_LEVEL: "loud" });
		expect(message).toMatch(/^Invalid configuration:/);
		for (const variable of ["AEGIS_ISSUER", "AEGIS_ENCRYPTION_KEY", "AEGIS_DATABASE_URL", "AEGIS_PORT", "AEGIS_LOG_LEVEL"]) {
			expect(message).toContain(`  - ${variable}: `);
		}
	});

	it("reports an unreadable environment as a whole", () => {
		expect(errorOf(null as unknown as Record<string, string>)).toContain("  - environment: ");
	});

	describe("AEGIS_TRUST_PROXY", () => {
		const trustProxyOf = (value: string) => loadConfig({ ...required, AEGIS_TRUST_PROXY: value }).trustProxy;

		it("turns trust off and on", () => {
			expect(trustProxyOf("")).toBe(false);
			expect(trustProxyOf("false")).toBe(false);
			expect(trustProxyOf("0")).toBe(false);
			expect(trustProxyOf(" TRUE ")).toBe(true);
		});

		it("trusts a number of hops", () => {
			const trust = trustProxyOf("2");
			expect(typeof trust).toBe("function");
			const hop = trust as (address: string, hop: number) => boolean;
			expect([hop("10.0.0.1", 0), hop("10.0.0.1", 1), hop("10.0.0.1", 2)]).toEqual([true, true, false]);
		});

		it("trusts a list of addresses and ranges", () => {
			expect(trustProxyOf("10.0.0.0/8, 192.168.1.1,,")).toEqual(["10.0.0.0/8", "192.168.1.1"]);
		});
	});
});
