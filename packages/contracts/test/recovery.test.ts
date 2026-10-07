import { describe, expect, it } from "vitest";
import { forgotPasswordSchema, passwordResetConfirmSchema, verificationLinkSchema } from "../src/recovery";
import { issueCodes } from "./support/issues";

describe("verificationLinkSchema", () => {
	it("accepts URL-safe tokens of a sane length", () => {
		expect(verificationLinkSchema.parse({ token: " abc_DEF-123 " })).toEqual({ token: "abc_DEF-123" });
		expect(issueCodes(verificationLinkSchema, { token: "a/b" })).toEqual(["invalid"]);
		expect(issueCodes(verificationLinkSchema, { token: "x".repeat(257) })).toEqual(["too_long"]);
	});
});

describe("password reset requests", () => {
	it("take an address, then the token and a new password", () => {
		expect(forgotPasswordSchema.parse({ email: "a@b.io" })).toEqual({ email: "a@b.io" });
		expect(issueCodes(passwordResetConfirmSchema, { token: "t", password: "1" })).toEqual(["password_too_short"]);
	});
});
