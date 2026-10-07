import { interactionPolicy } from "oidc-provider";
import { describe, expect, it, vi } from "vitest";
import { APPLICATION_ACCESS_REASON, createInteractionPolicy, SECOND_FACTOR_REASON, SESSION_REASON } from "../../src/oidc/policy.js";

vi.mock(import("oidc-provider"), async (importOriginal) => {
	const original = await importOriginal();
	return { ...original, interactionPolicy: { ...original.interactionPolicy, base: vi.fn(original.interactionPolicy.base) } };
});

const passes = async () => true;
const checks = { isSessionValid: passes, mayUseClient: passes, hasRequiredFactors: passes };

describe("createInteractionPolicy", () => {
	it("adds the Aegis checks to the sign-in prompt of the default policy", () => {
		const policy = createInteractionPolicy(checks);

		expect(policy.get("login")?.checks.map((check) => check.reason)).toEqual([
			"login_prompt",
			SESSION_REASON,
			APPLICATION_ACCESS_REASON,
			SECOND_FACTOR_REASON,
			"no_session",
			"max_age",
			"id_token_hint",
			"claims_id_token_sub_value",
			"essential_acrs",
			"essential_acr",
		]);
		expect(policy.get("consent")).toBeDefined();
	});

	it("refuses a default policy without a sign-in prompt", async () => {
		const { interactionPolicy: actual } = await vi.importActual<typeof import("oidc-provider")>("oidc-provider");
		vi.mocked(interactionPolicy.base).mockImplementationOnce(() => {
			const policy = actual.base();
			policy.remove("login");
			return policy;
		});

		expect(() => createInteractionPolicy(checks)).toThrow("missing the login prompt");
	});
});
