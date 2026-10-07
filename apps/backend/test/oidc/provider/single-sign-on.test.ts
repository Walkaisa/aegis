import { describe, expect } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../support/aegis.js";
import { awaitAuditEvent } from "../../support/audit.js";
import { authorize, challengeOf, createApplication, signInThrough } from "../../support/oidc.js";

describe("single sign-on", () => {
	test("ends with the Aegis session of the browser", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		const { browser } = await signInThrough(aegis, application, ADMIN);

		expect((await browser.delete("/api/auth/session")).statusCode).toBe(204);

		const authorization = await authorize(browser, application);
		expect(authorization.location.pathname).toBe("/sign-in");
	});

	test("ends when the account may no longer sign in to the application", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		const user = await aegis.createUser();
		const { browser } = await signInThrough(aegis, application, { email: user.email, password: USER_PASSWORD });

		// Directly in the database, so the provider session outlives the change.
		await aegis.services.clients.update(application.id, { accessPolicy: "assigned" }, new Date());
		const authorization = await authorize(browser, application);

		expect(authorization.location.pathname).toBe("/sign-in");
		const denied = await awaitAuditEvent(aegis, "oidc.authorization.denied");
		expect(denied).toMatchObject({ actor: { id: user.id }, client: { id: application.id } });
		const prompt = (await browser.get(`/api/auth/requests/${challengeOf(authorization.location)}`)).json();
		expect(prompt).toMatchObject({ type: "sign_in", deniedAccount: { email: user.email }, emailHint: null });
	});
});
