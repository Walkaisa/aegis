import { describe, expect } from "vitest";
import { ADMIN, test } from "../../../support/aegis.js";
import { auditEvents } from "../../../support/audit.js";
import { createApplication, exchangeCode, signInThrough, verifyIdToken } from "../../../support/oidc.js";

describe("/api/settings/keys", () => {
	test("shows the signing keys and the password hashing parameters", async ({ aegis }) => {
		const admin = await aegis.setup();

		const security = (await admin.get("/api/settings/keys")).json();

		expect(security).toEqual({
			signingKeys: [{ kid: expect.any(String), alg: "RS256", status: "active", createdAt: expect.any(String), retiredAt: null }],
			retiredKeyRetentionDays: 7,
			argon2: { memoryKiB: 19456, iterations: 1, parallelism: 1 },
		});
		expect(JSON.stringify(security)).not.toMatch(/"d"|privateJwk|Ciphertext/);
	});

	test("signs with a new key, while tokens of the old one still verify", async ({ aegis }) => {
		const admin = await aegis.setup();
		const application = await createApplication(admin, { skipConsent: true });
		const before = await signInThrough(aegis, application, ADMIN);
		const oldTokens = await exchangeCode(aegis, application, before.code, before.authorization.verifier);

		const rotated = (await admin.post("/api/settings/keys/rotate")).json();

		expect(rotated.signingKeys.map((key: { status: string }) => key.status)).toEqual(["active", "retired"]);
		const [active, retired] = rotated.signingKeys as { kid: string }[];
		const { keys } = (await aegis.client().get("/.well-known/jwks.json")).json() as { keys: { kid: string }[] };
		expect(keys.map((key) => key.kid)).toEqual([active?.kid, retired?.kid]);
		await verifyIdToken(aegis, application, oldTokens.id_token, before.authorization.nonce);

		const after = await signInThrough(aegis, application, ADMIN);
		const newTokens = await exchangeCode(aegis, application, after.code, after.authorization.verifier);
		const header = JSON.parse(Buffer.from(newTokens.id_token.split(".")[0] ?? "", "base64url").toString());
		expect(header.kid).toBe(active?.kid);
		const [event] = await auditEvents(aegis, "signing_key.rotated");
		expect(event?.metadata).toEqual({ kid: active?.kid });
	});
});
