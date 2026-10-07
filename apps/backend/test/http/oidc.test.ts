import { describe, expect, vi } from "vitest";
import { test } from "../support/aegis.js";
import { authorize, createApplication } from "../support/oidc.js";

describe("protocol endpoint", () => {
	test("answers with a server error when the provider fails", async ({ aegis }) => {
		await aegis.setup();
		vi.spyOn(aegis.services.oidc, "handle").mockRejectedValueOnce(new Error("boom"));

		const response = await aegis.client().get("/.well-known/openid-configuration");

		expect(response.statusCode).toBe(500);
		expect(response.json()).toEqual({ error: "server_error" });
	});

	test("leaves a response alone that the provider already started", async ({ aegis }) => {
		await aegis.setup();
		vi.spyOn(aegis.services.oidc, "handle").mockImplementationOnce(async (_req, res) => {
			res.writeHead(200, { "content-type": "text/plain" });
			res.end("partial");
			throw new Error("boom");
		});

		const response = await aegis.client().get("/.well-known/openid-configuration");

		expect(response.statusCode).toBe(200);
		expect(response.body).toBe("partial");
	});

	test("logs provider errors and failed bookkeeping", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const error = vi.spyOn(aegis.app.log, "error");

		vi.spyOn(aegis.services.oidcArtifacts, "find").mockRejectedValueOnce(new Error("database down"));
		const failed = await aegis.app.inject({ method: "GET", url: "/oauth2/userinfo", headers: { authorization: "Bearer token" } });
		expect(failed.statusCode).toBe(500);
		expect(failed.json()).toMatchObject({ error: "server_error" });
		expect(error).toHaveBeenCalledWith(expect.objectContaining({ path: "/oauth2/userinfo" }), "OpenID provider error");

		vi.spyOn(aegis.services.audit, "record").mockRejectedValueOnce(new Error("database down"));
		await authorize(aegis.client(), application, { redirect_uri: "https://evil.aegis.test/callback" });
		await vi.waitFor(() => expect(error).toHaveBeenCalledWith(expect.anything(), "Failed to record an authorization error"));
	});
});
