import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { describe, expect, vi } from "vitest";
import { createProvider } from "../../../src/oidc/provider.js";
import { ADMIN, test } from "../../support/aegis.js";
import { createApplication, signInThrough } from "../../support/oidc.js";
import { oidcDependencies } from "../../support/oidc-provider.js";

describe("createProvider", () => {
	test("needs the initial setup", async ({ aegis }) => {
		await expect(createProvider(oidcDependencies(aegis))).rejects.toThrow("before the initial setup");
		const request = new IncomingMessage(new Socket());
		expect(() => aegis.services.oidc.handle(request, new ServerResponse(request))).toThrow("The initial setup has not been completed");
	});

	test("names the instance on the sign-out page even without its settings", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { browser } = await signInThrough(aegis, application, ADMIN);

		const german = await browser.get("/oauth2/sign-out", { headers: { "accept-language": "de" } });
		expect(german.body).toContain("Möchtest du dich von Aegis Test abmelden?");

		vi.spyOn(aegis.services.settings, "get").mockReturnValue(null);
		const fallback = await browser.get("/oauth2/sign-out");
		expect(fallback.body).toContain("Do you want to sign out of Aegis?");
	});
});
