import { describe, expect } from "vitest";
import { ADMIN, test } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { applicationInput, createApplication, signInThrough } from "../../../support/oidc.js";

describe("GET /api/applications", () => {
	test("lists the applications with their usage", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		await signInThrough(aegis, application, ADMIN);

		const response = await admin.get("/api/applications");

		expect(response.json().clients).toEqual([
			expect.objectContaining({
				id: application.id,
				name: "Wiki",
				type: "confidential",
				assignedUserCount: 0,
				logoUrl: null,
				secretRotatedAt: expect.any(String),
			}),
		]);
	});

	test("is reserved for admins", async ({ aegis }) => {
		await aegis.setup();
		const user = await aegis.sessionFor(await aegis.createUser());

		expect((await aegis.client().get("/api/applications")).statusCode).toBe(401);
		expect((await user.get("/api/applications")).statusCode).toBe(403);
		expect((await user.post("/api/applications", applicationInput())).statusCode).toBe(403);
	});
});

describe("POST /api/applications", () => {
	test("returns the secret of a confidential client once and stores it encrypted", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.post("/api/applications", applicationInput());

		expect(response.statusCode).toBe(201);
		const { client, clientSecret } = response.json();
		expect(clientSecret).toMatch(/^[\w-]{43}$/);
		expect(client).toMatchObject({
			tokenEndpointAuthMethod: "client_secret_basic",
			pkcePolicy: "optional",
			accessPolicy: "everyone",
			enabled: true,
		});
		const stored = await aegis.services.clients.findById(client.id);
		expect(stored?.clientSecretCiphertext).not.toContain(clientSecret);
		expect(JSON.stringify((await admin.get(`/api/applications/${client.id}`)).json())).not.toContain(clientSecret);
		const [created] = await auditEvents(aegis, "client.created");
		expect(created).toMatchObject({
			actor: { label: ADMIN.email },
			client: { id: client.id, label: "Wiki" },
			metadata: { type: "confidential", scopes: ["openid", "profile", "email"], accessPolicy: "everyone", pkcePolicy: "optional" },
		});
	});

	test("creates public clients without a secret and with PKCE", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.post(
			"/api/applications",
			applicationInput({ type: "public", tokenEndpointAuthMethod: "client_secret_post" }),
		);

		expect(response.json().clientSecret).toBeNull();
		expect(response.json().client).toMatchObject({
			type: "public",
			tokenEndpointAuthMethod: "none",
			pkcePolicy: "required",
			secretRotatedAt: null,
		});
	});

	test("rejects settings that would weaken the flow", async ({ aegis }) => {
		const admin = await aegis.setup();

		const withoutPkce = await admin.post("/api/applications", applicationInput({ type: "public", pkcePolicy: "optional" }));
		expect(withoutPkce.json().error.issues).toEqual([{ path: "pkcePolicy", code: "pkce_required_for_public_clients" }]);

		const customScheme = await admin.post("/api/applications", applicationInput({ redirectUris: ["com.example.app:/callback"] }));
		expect(customScheme.json().error.issues).toEqual([{ path: "redirectUris.0", code: "redirect_uri_custom_scheme" }]);

		const insecure = await admin.post("/api/applications", applicationInput({ redirectUris: ["http://app.aegis.test/callback"] }));
		expect(insecure.json().error.issues).toEqual([{ path: "redirectUris.0", code: "redirect_uri_insecure" }]);
	});
});
