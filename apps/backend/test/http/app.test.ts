import { describe, expect, vi } from "vitest";
import { ADMIN, startAegis, test } from "../support/aegis.js";
import { enableEmail, test as withSmtp } from "../support/smtp.js";

describe("an HTTPS deployment", () => {
	test("sends HSTS and keeps its cookies to its own host", async () => {
		const aegis = await startAegis({ env: { AEGIS_ISSUER: "https://auth.aegis.test" } });
		try {
			const admin = await aegis.setup();

			const session = await admin.get("/api/auth/session");
			expect(session.headers["strict-transport-security"]).toBe("max-age=31536000; includeSubDomains");
			expect(admin.cookie("__Host-aegis_session")).toBeDefined();
			const signedOut = await admin.delete("/api/auth/session");
			expect(String(signedOut.headers["set-cookie"])).toMatch(/^__Host-aegis_session=;.*Secure/);
		} finally {
			await aegis.close();
		}
	});

	test("is not announced over plain HTTP", async ({ aegis }) => {
		expect((await aegis.client().get("/api/instance")).headers["strict-transport-security"]).toBeUndefined();
	});
});

describe("requests", () => {
	test("about an account that is gone meanwhile end with 404", async ({ aegis }) => {
		const admin = await aegis.setup();
		vi.spyOn(aegis.services.users, "findSummary").mockResolvedValue(null);

		expect((await admin.get("/api/auth/session")).statusCode).toBe(404);
		expect((await admin.get("/api/account")).statusCode).toBe(404);
	});

	test("for the setup end with 404 when the new account is gone at once", async ({ aegis }) => {
		vi.spyOn(aegis.services.users, "findSummary").mockResolvedValue(null);

		const response = await aegis.client().post("/api/setup", { instanceName: "Aegis Test", ...ADMIN });

		expect(response.statusCode).toBe(404);
	});
});

describe("password reset requests", () => {
	withSmtp("are answered at once, even when handling them fails later", async ({ aegis, smtp }) => {
		const admin = await aegis.setup();
		await enableEmail(admin, smtp);
		const failure = vi.spyOn(aegis.services.recovery, "requestPasswordReset").mockRejectedValueOnce(new Error("database down"));

		const response = await aegis.client().post("/api/auth/password-reset", { email: ADMIN.email });

		expect(response.statusCode).toBe(202);
		await vi.waitFor(() => expect(failure).toHaveBeenCalled());
	});
});
