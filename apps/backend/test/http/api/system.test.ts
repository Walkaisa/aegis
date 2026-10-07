import { describe, expect, vi } from "vitest";
import { ADMIN, test } from "../../support/aegis.js";
import { uniqueViolation } from "../../support/database.js";

describe("GET /api/health", () => {
	test("answers without a session and is never cached", async ({ aegis }) => {
		const response = await aegis.client().get("/api/health");

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ status: "ok" });
		expect(response.headers["cache-control"]).toBe("no-store");
		expect(response.headers["content-security-policy"]).toBe("default-src 'none'; frame-ancestors 'none'");
	});
});

describe("GET /api/instance", () => {
	test("reports a pending setup", async ({ aegis }) => {
		const response = await aegis.client().get("/api/instance");

		expect(response.json()).toEqual({
			setupRequired: true,
			instanceName: null,
			issuer: "http://localhost:3000",
			version: aegis.config.version,
			passwordResetEnabled: false,
		});
	});

	test("reports the instance name once set up", async ({ aegis }) => {
		await aegis.setup();

		const response = await aegis.client().get("/api/instance");

		expect(response.json()).toMatchObject({ setupRequired: false, instanceName: "Aegis Test" });
	});
});

describe("POST /api/setup", () => {
	test("creates the first admin, signs it in and closes the setup", async ({ aegis }) => {
		const browser = aegis.client();

		const response = await browser.post("/api/setup", { instanceName: "Aegis Test", ...ADMIN });

		expect(response.statusCode).toBe(201);
		expect(response.json()).toMatchObject({
			account: { email: ADMIN.email, displayName: ADMIN.displayName, role: "admin", enabled: true, isLastActiveAdmin: true },
			instanceName: "Aegis Test",
		});
		expect(browser.cookie("aegis_session")).toBeDefined();
		expect((await browser.get("/api/auth/session")).statusCode).toBe(200);
		expect(aegis.services.oidc.provider).not.toBeNull();

		const again = await aegis.client().post("/api/setup", { instanceName: "Other", ...ADMIN, email: "other@aegis.test" });
		expect(again.statusCode).toBe(409);
		expect(again.json()).toMatchObject({ error: { code: "setup_completed" } });
	});

	test("rejects invalid input with the failing fields", async ({ aegis }) => {
		const response = await aegis.client().post("/api/setup", { instanceName: "", displayName: "A", email: "nope", password: "short" });

		expect(response.statusCode).toBe(400);
		expect(response.json().error.code).toBe("validation_failed");
		expect(
			response
				.json()
				.error.issues.map((issue: { path: string }) => issue.path)
				.sort(),
		).toEqual(["email", "instanceName", "password"]);
	});

	test("lets a concurrent setup lose", async ({ aegis }) => {
		vi.spyOn(aegis.services.settings, "insert").mockRejectedValueOnce(uniqueViolation()).mockRejectedValueOnce(new Error("disk full"));
		const setup = { instanceName: "Aegis Test", ...ADMIN };

		const lost = await aegis.client().post("/api/setup", setup);
		expect(lost.statusCode).toBe(409);
		expect(lost.json().error.code).toBe("setup_completed");
		expect((await aegis.client().post("/api/setup", setup)).statusCode).toBe(500);
		expect(aegis.services.settings.isSetupComplete()).toBe(false);
	});
});
