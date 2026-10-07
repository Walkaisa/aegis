import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect } from "@playwright/test";

/** Where the setup stores the session of the first administrator for the other specs. */
export const ADMIN_STATE = "test-results/.auth/admin.json";

/** Accounts of the throwaway instance the tests run against. */
export const ADMIN = { displayName: "Ada Admin", email: "admin@aegis.test", password: "correct horse battery staple" };
export const USER_PASSWORD = "a sufficiently long password";

/**
 * Creates an account through the API with the session of the administrator. The address is new
 * every time, so a retried spec does not collide with the account of its first attempt.
 */
export async function createUser(api: APIRequestContext): Promise<{ id: string; email: string }> {
	const email = `grace-${randomUUID()}@aegis.test`;
	const response = await api.post("/api/users", {
		data: { displayName: "Grace Hopper", email, password: USER_PASSWORD, role: "user", enabled: true, emailVerified: true },
	});
	expect(response.status()).toBe(201);
	const { user } = await response.json();
	return { id: user.id, email };
}
