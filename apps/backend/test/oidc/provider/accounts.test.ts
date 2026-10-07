import { describe, expect } from "vitest";
import { test, USER_PASSWORD } from "../../support/aegis.js";
import { createApplication, exchangeCode, signInThrough, userinfo } from "../../support/oidc.js";

describe("accounts", () => {
	test("have no claims once they are disabled, even behind Aegis' back", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin);
		const user = await aegis.createUser();
		const { authorization, code } = await signInThrough(aegis, application, { email: user.email, password: USER_PASSWORD });
		const tokens = await exchangeCode(aegis, application, code, authorization.verifier);

		await aegis.services.users.update(user.id, { enabled: false }, new Date());

		expect((await userinfo(aegis, tokens.access_token)).statusCode).toBe(401);
	});
});
