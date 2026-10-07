import { describe, expect, vi } from "vitest";
import { test } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { testImage } from "../../../support/images.js";
import { createApplication } from "../../../support/oidc.js";

describe("/api/applications/:id/logo", () => {
	test("sets, serves and removes the logo", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);

		const set = await admin.request("PUT", `/api/applications/${application.id}/logo`, {
			headers: { "content-type": "image/webp" },
			payload: await testImage("webp"),
		});
		const logoUrl = set.json().client.logoUrl as string;
		expect(logoUrl).toMatch(new RegExp(`^/api/media/logos/${application.id}/[0-9a-f]{32}\\.webp$`));
		const image = await aegis.client().get(logoUrl);
		expect(image.headers["content-type"]).toBe("image/webp");
		expect(image.headers["cross-origin-resource-policy"]).toBe("cross-origin");

		expect((await admin.delete(`/api/applications/${application.id}/logo`)).json().client.logoUrl).toBeNull();
		expect((await aegis.client().get(logoUrl)).statusCode).toBe(404);
		expect((await admin.delete(`/api/applications/${application.id}/logo`)).json().client.logoUrl).toBeNull();
		expect(await auditEvents(aegis, "client.logo_updated")).toHaveLength(1);
		expect(await auditEvents(aegis, "client.logo_removed")).toHaveLength(1);
	});

	test("rejects logos of unknown applications", async ({ aegis }) => {
		const admin = await aegis.setup();

		const response = await admin.request("PUT", "/api/applications/1/logo", {
			headers: { "content-type": "image/png" },
			payload: await testImage(),
		});

		expect(response.statusCode).toBe(404);
	});

	test("gives up when the application disappears while its logo is removed", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		await admin.request("PUT", `/api/applications/${application.id}/logo`, {
			headers: { "content-type": "image/png" },
			payload: await testImage(),
		});

		vi.spyOn(aegis.services.clients, "update").mockResolvedValueOnce(null);
		const response = await admin.delete(`/api/applications/${application.id}/logo`);

		expect(response.statusCode).toBe(404);
		expect((await admin.get(`/api/applications/${application.id}`)).json().client.logoUrl).not.toBeNull();
	});
});
