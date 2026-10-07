import { describe, expect, it } from "vitest";
import {
	secondFactorRequestSchema,
	totpCodeSchema,
	twoFactorConfirmSchema,
	twoFactorEnableSchema,
	twoFactorSetupSchema,
} from "../src/two-factor";
import { issueCodes } from "./support/issues";

describe("totpCodeSchema", () => {
	it("normalizes authenticator codes", () => {
		expect(totpCodeSchema.parse("123 456")).toBe("123456");
		expect(issueCodes(totpCodeSchema, "")[0]).toBe("required");
		expect(issueCodes(totpCodeSchema, "12345")).toEqual(["totp_code_invalid"]);
		expect(issueCodes(totpCodeSchema, "abcdef")).toEqual(["totp_code_invalid"]);
	});
});

describe("two-factor requests", () => {
	it("validate codes, passwords and labels", () => {
		expect(secondFactorRequestSchema.parse({ code: " K7PQM-3XHVT " })).toEqual({ code: "K7PQM-3XHVT" });
		expect(issueCodes(secondFactorRequestSchema, { code: "x".repeat(65) })).toEqual(["too_long"]);
		expect(twoFactorSetupSchema.parse({ currentPassword: "p" })).toEqual({ currentPassword: "p" });
		expect(twoFactorEnableSchema.parse({ code: "123456" })).toEqual({ code: "123456" });
		expect(twoFactorEnableSchema.parse({ code: "123456", label: " Phone " })).toEqual({ code: "123456", label: "Phone" });
		expect(issueCodes(twoFactorEnableSchema, { code: "123456", label: "x".repeat(65) })).toEqual(["too_long"]);
		expect(twoFactorConfirmSchema.parse({ currentPassword: "p", code: "123456" })).toBeTruthy();
	});
});
