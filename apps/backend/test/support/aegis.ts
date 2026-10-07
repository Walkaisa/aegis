import { randomBytes } from "node:crypto";
import { normalizeEmail, type Role } from "@aegis/contracts";
import type { UserRecord } from "@aegis/db";
import type { FastifyInstance } from "fastify";
import { test as base, expect } from "vitest";
import { type AppConfig, loadConfig } from "../../src/config.js";
import { buildApp } from "../../src/http/app.js";
import { newId } from "../../src/lib/snowflakes.js";
import type { AppServices } from "../../src/services/container.js";
import { TestClient } from "./client.js";
import { createTestDatabase } from "./database.js";

export const ISSUER = "http://localhost:3000";
export const ADMIN = { displayName: "Ada Admin", email: "admin@aegis.test", password: "correct horse battery staple" };
export const USER_PASSWORD = "a sufficiently long password";
/** The origin of a request that tells neither the client address nor the browser. */
export const NO_ORIGIN = { ip: null, userAgent: null };

/** Environment of a test instance; Argon2 runs with the smallest parameters Aegis accepts. */
export function testEnv(overrides: Record<string, string> = {}): Record<string, string> {
	return {
		NODE_ENV: "test",
		AEGIS_ISSUER: ISSUER,
		AEGIS_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
		AEGIS_DATABASE_URL: "postgres://unused@localhost/unused",
		AEGIS_LOG_LEVEL: "silent",
		AEGIS_ARGON2_MEMORY_KIB: "19456",
		AEGIS_ARGON2_ITERATIONS: "1",
		AEGIS_ARGON2_PARALLELISM: "1",
		AEGIS_UPDATE_CHECK: "false",
		...overrides,
	};
}

export interface StartOptions {
	env?: Record<string, string>;
	config?: Partial<AppConfig>;
}

export interface TestAegis {
	app: FastifyInstance;
	services: AppServices;
	config: AppConfig;
	/** A new browser with its own cookies and IP address. */
	client(ip?: string): TestClient;
	/** Completes the initial setup and returns the signed-in browser of the first admin. */
	setup(): Promise<TestClient>;
	/** Creates an account directly in the database. */
	createUser(options?: { email?: string; password?: string; role?: Role; displayName?: string; enabled?: boolean }): Promise<UserRecord>;
	/** A browser signed in to the administration with the given account. */
	signIn(email: string, password: string): Promise<TestClient>;
	/** A browser holding a session of the account, whatever its role, as after any sign-in. */
	sessionFor(user: UserRecord): Promise<TestClient>;
	close(): Promise<void>;
}

let userNumber = 0;

/** A complete Aegis on a database of its own, as `src/index.ts` starts it (without listening on a port). */
export async function startAegis(options: StartOptions = {}): Promise<TestAegis> {
	const database = await createTestDatabase();
	const config: AppConfig = { ...loadConfig(testEnv({ AEGIS_DATABASE_URL: database.url, ...options.env })), ...options.config };
	const { app, services } = await buildApp(config);
	await services.oidc.reload();

	const aegis: TestAegis = {
		app,
		services,
		config,
		client: (ip) => new TestClient(app, config.issuer, ip),
		async setup() {
			const admin = aegis.client();
			const response = await admin.post("/api/setup", { instanceName: "Aegis Test", ...ADMIN });
			expect(response.statusCode).toBe(201);
			return admin;
		},
		async createUser({ email, password = USER_PASSWORD, role = "user", displayName, enabled = true } = {}) {
			userNumber += 1;
			const now = new Date();
			const address = email ?? `user${userNumber}@aegis.test`;
			return services.users.insert({
				id: newId(),
				email: address,
				emailNormalized: normalizeEmail(address),
				displayName: displayName ?? `User ${userNumber}`,
				passwordHash: await services.passwords.hash(password),
				role,
				enabled,
				emailVerified: true,
				passwordChangedAt: now,
				createdAt: now,
				updatedAt: now,
			});
		},
		async signIn(email, password) {
			const browser = aegis.client();
			const response = await browser.post("/api/auth/session", { email, password });
			expect(response.statusCode).toBe(201);
			return browser;
		},
		async sessionFor(user) {
			const browser = aegis.client();
			const { token } = await services.auth.createSession(user, { ip: browser.ip, userAgent: "Aegis tests" });
			browser.setCookie(services.sessionCookie.name, token);
			return browser;
		},
		async close() {
			await app.close();
			await database.drop();
		},
	};
	return aegis;
}

/** `test` with a fresh Aegis per test: `test("…", async ({ aegis }) => { … })`. */
export const test = base.extend<{ aegis: TestAegis }>({
	// biome-ignore lint/correctness/noEmptyPattern: Vitest reads the fixtures a fixture depends on from this pattern.
	aegis: async ({}, use) => {
		const aegis = await startAegis();
		await use(aegis);
		await aegis.close();
	},
});
