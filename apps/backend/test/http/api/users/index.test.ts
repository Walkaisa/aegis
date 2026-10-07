import { describe, expect, vi } from "vitest";
import { ADMIN, test } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { uniqueViolation } from "../../../support/database.js";

const newUser = {
	displayName: "Grace",
	email: "grace@aegis.test",
	password: "a sufficiently long password",
	role: "user",
	enabled: true,
	emailVerified: false,
};

describe("GET /api/users", () => {
	test("lists admins first, then users, each alphabetically", async ({ aegis }) => {
		const admin = await aegis.setup();
		await aegis.createUser({ displayName: "zoe", role: "user" });
		await aegis.createUser({ displayName: "Bob", role: "admin" });
		await aegis.createUser({ displayName: "anna", role: "user" });

		const response = await admin.get("/api/users");

		expect(response.json().users.map((user: { displayName: string; role: string }) => `${user.role}:${user.displayName}`)).toEqual([
			"admin:Ada Admin",
			"admin:Bob",
			"user:anna",
			"user:zoe",
		]);
		expect(response.json().users[0]).toMatchObject({ activeSessionCount: 1, isLastActiveAdmin: false });
	});

	test("is reserved for accounts that may read users", async ({ aegis }) => {
		await aegis.setup();
		const user = await aegis.sessionFor(await aegis.createUser());

		expect((await aegis.client().get("/api/users")).statusCode).toBe(401);
		const forbidden = await user.get("/api/users");
		expect(forbidden.statusCode).toBe(403);
		expect(forbidden.json().error.code).toBe("forbidden");
	});
});

describe("POST /api/users", () => {
	test("creates an account", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.post("/api/users", newUser);

		expect(response.statusCode).toBe(201);
		expect(response.json().user).toMatchObject({
			email: "grace@aegis.test",
			role: "user",
			emailVerified: false,
			activeSessionCount: 0,
		});
		expect((await aegis.client().post("/api/auth/session", { email: newUser.email, password: newUser.password })).statusCode).toBe(403);
		const [event] = await auditEvents(aegis, "user.created");
		expect(event).toMatchObject({
			actor: { label: ADMIN.email },
			subject: { label: "grace@aegis.test" },
			metadata: { role: "user", enabled: true },
		});
	});

	test("rejects an address in use, whatever its case", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.post("/api/users", { ...newUser, email: ADMIN.email.toUpperCase() });

		expect(response.statusCode).toBe(409);
		expect(response.json().error.code).toBe("email_taken");
	});

	test("reports an address taken meanwhile and fails on anything else", async ({ aegis }) => {
		const admin = await aegis.setup();
		vi.spyOn(aegis.services.users, "insert").mockRejectedValueOnce(uniqueViolation()).mockRejectedValueOnce(new Error("disk full"));

		expect((await admin.post("/api/users", newUser)).json().error.code).toBe("email_taken");
		expect((await admin.post("/api/users", newUser)).statusCode).toBe(500);
	});
});
