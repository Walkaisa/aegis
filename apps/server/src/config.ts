import { z } from "zod";
import { parseEncryptionKey } from "./crypto/encryption.js";
import type { Argon2Settings } from "./crypto/passwords.js";
import { AEGIS_VERSION } from "./version.js";

export type TrustProxySetting = boolean | string[] | ((address: string, hop: number) => boolean);

export interface AppConfig {
	env: "development" | "production";
	isProduction: boolean;
	version: string;
	/** Public issuer URL without trailing slash, e.g. `https://auth.example.com`. */
	issuer: string;
	issuerOrigin: string;
	/** Cookies are marked `Secure` (and use the `__Host-` prefix) when the issuer uses HTTPS. */
	secureCookies: boolean;
	encryptionKey: Buffer;
	databaseUrl: string;
	host: string;
	port: number;
	webUpstream: string;
	trustProxy: TrustProxySetting;
	logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
	argon2: Argon2Settings;
	auditRetentionDays: number;
	/** Whether Aegis looks for new releases on GitHub. */
	updateCheck: boolean;
}

export class ConfigError extends Error {
	public constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

const envSchema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	AEGIS_ISSUER: z.string().min(1, "AEGIS_ISSUER is required"),
	AEGIS_ENCRYPTION_KEY: z.string().min(1, "AEGIS_ENCRYPTION_KEY is required"),
	AEGIS_DATABASE_URL: z.string().min(1, "AEGIS_DATABASE_URL is required"),
	AEGIS_HOST: z.string().min(1).default("0.0.0.0"),
	AEGIS_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
	AEGIS_WEB_UPSTREAM: z.string().min(1).default("http://127.0.0.1:3001"),
	AEGIS_TRUST_PROXY: z.string().default("false"),
	AEGIS_LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
	AEGIS_ARGON2_MEMORY_KIB: z.coerce.number().int().min(19_456).max(4_194_304).default(65_536),
	AEGIS_ARGON2_ITERATIONS: z.coerce.number().int().min(1).max(64).default(3),
	AEGIS_ARGON2_PARALLELISM: z.coerce.number().int().min(1).max(64).default(4),
	AEGIS_AUDIT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(180),
	AEGIS_UPDATE_CHECK: z.stringbool().default(true),
});

function parseIssuer(raw: string, isProduction: boolean): URL {
	let url: URL;
	try {
		url = new URL(raw.trim());
	} catch {
		throw new ConfigError("AEGIS_ISSUER must be an absolute URL, e.g. https://auth.example.com");
	}

	if (url.protocol !== "https:" && url.protocol !== "http:") {
		throw new ConfigError("AEGIS_ISSUER must use https (or http for local development)");
	}
	if (url.search || url.hash || url.username || url.password) {
		throw new ConfigError("AEGIS_ISSUER must not contain credentials, a query or a fragment");
	}
	if (url.pathname !== "/") {
		throw new ConfigError("AEGIS_ISSUER must be an origin without a path; Aegis is served from the root of its host");
	}
	if (isProduction && url.protocol !== "https:" && !LOCAL_HOSTS.has(url.hostname)) {
		throw new ConfigError("AEGIS_ISSUER must use https in production");
	}
	return url;
}

function parseDatabaseUrl(raw: string): string {
	try {
		const url = new URL(raw);
		if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
			throw new Error();
		}
		return raw;
	} catch {
		throw new ConfigError("AEGIS_DATABASE_URL must be a PostgreSQL connection URL, e.g. postgres://aegis:secret@localhost:5432/aegis");
	}
}

function parseTrustProxy(raw: string): TrustProxySetting {
	const value = raw.trim().toLowerCase();
	if (value === "" || value === "false" || value === "0") {
		return false;
	}
	if (value === "true") {
		return true;
	}
	if (/^\d+$/.test(value)) {
		// Trust the given number of proxy hops in front of Aegis.
		const hops = Number(value);
		return (_address, hop) => hop < hops;
	}
	return value
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function parseUpstream(raw: string): string {
	try {
		const url = new URL(raw);
		if (url.protocol !== "http:" && url.protocol !== "https:") {
			throw new Error();
		}
		return url.origin;
	} catch {
		throw new ConfigError("AEGIS_WEB_UPSTREAM must be an http(s) URL, e.g. http://web:3001");
	}
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
	const parsed = envSchema.safeParse(env);
	if (!parsed.success) {
		const details = parsed.error.issues.map((issue) => `  - ${issue.path.join(".") || "environment"}: ${issue.message}`).join("\n");
		throw new ConfigError(`Invalid configuration:\n${details}`);
	}

	const values = parsed.data;
	const isProduction = values.NODE_ENV === "production";
	const issuerUrl = parseIssuer(values.AEGIS_ISSUER, isProduction);

	let encryptionKey: Buffer;
	try {
		encryptionKey = parseEncryptionKey(values.AEGIS_ENCRYPTION_KEY);
	} catch (error) {
		throw new ConfigError((error as Error).message);
	}

	return {
		env: isProduction ? "production" : "development",
		isProduction,
		version: AEGIS_VERSION,
		issuer: issuerUrl.origin,
		issuerOrigin: issuerUrl.origin,
		secureCookies: issuerUrl.protocol === "https:",
		encryptionKey,
		databaseUrl: parseDatabaseUrl(values.AEGIS_DATABASE_URL),
		host: values.AEGIS_HOST,
		port: values.AEGIS_PORT,
		webUpstream: parseUpstream(values.AEGIS_WEB_UPSTREAM),
		trustProxy: parseTrustProxy(values.AEGIS_TRUST_PROXY),
		logLevel: values.AEGIS_LOG_LEVEL,
		argon2: {
			memoryKiB: values.AEGIS_ARGON2_MEMORY_KIB,
			iterations: values.AEGIS_ARGON2_ITERATIONS,
			parallelism: values.AEGIS_ARGON2_PARALLELISM,
		},
		auditRetentionDays: values.AEGIS_AUDIT_RETENTION_DAYS,
		updateCheck: values.AEGIS_UPDATE_CHECK,
	};
}
