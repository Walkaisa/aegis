import { describe, expect } from "vitest";
import { ADMIN, test, USER_PASSWORD } from "../../support/aegis.js";
import { createApplication, exchangeCode, signInThrough, tokenRequest, userinfo } from "../../support/oidc.js";

describe("token revocation", () => {
	test("invalidates a revoked access token", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);

		const revoked = await tokenRequest(aegis, application, { token: tokens.access_token }, undefined, "/oauth2/revoke");

		expect(revoked.statusCode).toBe(200);
		expect((await userinfo(aegis, tokens.access_token)).statusCode).toBe(401);
	});

	test("lets only the application a token was issued to revoke it", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const other = await createApplication(admin, { name: "Other" });
		const spa = await createApplication(admin, { name: "Dashboard", type: "public" });
		const { authorization, code } = await signInThrough(aegis, application, ADMIN);
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);

		const foreign = await tokenRequest(aegis, other, { token: tokens.access_token }, undefined, "/oauth2/revoke");
		expect(foreign.statusCode).toBe(400);
		expect(foreign.json()).toMatchObject({ error: "invalid_request" });

		// A public client proves nothing, so it learns nothing either.
		const unproven = await tokenRequest(aegis, spa, { token: tokens.access_token }, "none", "/oauth2/revoke");
		expect(unproven.statusCode).toBe(200);

		expect((await userinfo(aegis, tokens.access_token)).statusCode).toBe(200);
	});

	test("invalidates the tokens of a disabled account", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const user = await aegis.createUser();
		const { authorization, code } = await signInThrough(aegis, application, { email: user.email, password: USER_PASSWORD });
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);

		await admin.post(`/api/users/${user.id}/disable`);

		expect((await userinfo(aegis, tokens.access_token)).statusCode).toBe(401);
	});
});
