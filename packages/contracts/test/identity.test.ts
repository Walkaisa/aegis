import { describe, expect, it } from "vitest";
import { codePointLength } from "../src/common";
import {
	displayNameSchema,
	EMAIL_MAX_LENGTH,
	emailSchema,
	evaluatePassword,
	existingPasswordSchema,
	instanceNameSchema,
	newPasswordSchema,
	normalizeEmail,
	PASSWORD_MAX_LENGTH,
	PASSWORD_MIN_LENGTH,
	passwordStrength,
} from "../src/identity";

const issueOf = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues[0]?.message;

describe("codePointLength", () => {
	it("counts code points, not UTF-16 units", () => {
		expect(codePointLength("")).toBe(0);
		expect(codePointLength("abc")).toBe(3);
		expect(codePointLength("🔐🔑")).toBe(2);
		expect("🔐🔑".length).toBe(4);
	});
});

describe("newPasswordSchema", () => {
	it("accepts passwords between the limits exactly as entered", () => {
		expect(newPasswordSchema.parse("  spaced  ")).toBe("  spaced  ");
		expect(newPasswordSchema.parse("x".repeat(PASSWORD_MIN_LENGTH))).toHaveLength(PASSWORD_MIN_LENGTH);
		expect(newPasswordSchema.safeParse("x".repeat(PASSWORD_MAX_LENGTH)).success).toBe(true);
	});

	it("counts characters the way a person does", () => {
		expect(newPasswordSchema.safeParse("🔐".repeat(PASSWORD_MIN_LENGTH)).success).toBe(true);
		expect(issueOf(newPasswordSchema.safeParse("🔐".repeat(PASSWORD_MIN_LENGTH - 1)))).toBe("password_too_short");
	});

	it("rejects passwords that are too short or too long", () => {
		expect(issueOf(newPasswordSchema.safeParse("x".repeat(PASSWORD_MIN_LENGTH - 1)))).toBe("password_too_short");
		expect(issueOf(newPasswordSchema.safeParse("x".repeat(PASSWORD_MAX_LENGTH + 1)))).toBe("password_too_long");
		expect(issueOf(newPasswordSchema.safeParse(undefined))).toBe("required");
	});
});

describe("existingPasswordSchema", () => {
	it("accepts any non-empty password up to a generous bound", () => {
		expect(existingPasswordSchema.parse("x")).toBe("x");
		expect(issueOf(existingPasswordSchema.safeParse(""))).toBe("required");
		expect(issueOf(existingPasswordSchema.safeParse("x".repeat(PASSWORD_MAX_LENGTH * 4 + 1)))).toBe("password_too_long");
	});
});

describe("evaluatePassword and passwordStrength", () => {
	it("checks each requirement, including non-Latin letters and digits", () => {
		expect(evaluatePassword("Äb3!xxxx")).toEqual({ length: true, lowercase: true, uppercase: true, digit: true, symbol: true });
		expect(evaluatePassword("abc")).toEqual({ length: false, lowercase: true, uppercase: false, digit: false, symbol: false });
		expect(evaluatePassword("٣ ")).toMatchObject({ digit: true, symbol: true });
	});

	it("maps the score to a level", () => {
		expect(passwordStrength("")).toEqual({ score: 0, level: "weak" });
		expect(passwordStrength("a")).toEqual({ score: 1, level: "weak" });
		expect(passwordStrength("aB")).toEqual({ score: 2, level: "fair" });
		expect(passwordStrength("aB1")).toEqual({ score: 3, level: "good" });
		expect(passwordStrength("aB1!")).toEqual({ score: 4, level: "strong" });
		expect(passwordStrength("aB1!aB1!")).toEqual({ score: 5, level: "strong" });
	});
});

describe("emailSchema and normalizeEmail", () => {
	it("trims and validates addresses", () => {
		expect(emailSchema.parse("  ada@example.com ")).toBe("ada@example.com");
		expect(issueOf(emailSchema.safeParse(" "))).toBe("required");
		expect(issueOf(emailSchema.safeParse("not-an-address"))).toBe("email_invalid");
		expect(issueOf(emailSchema.safeParse(`${"a".repeat(EMAIL_MAX_LENGTH)}@x.io`))).toBe("too_long");
		expect(issueOf(emailSchema.safeParse(42))).toBe("required");
	});

	it("compares addresses case-insensitively", () => {
		expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
	});
});

describe("names", () => {
	it("trims display and instance names within their limits", () => {
		expect(displayNameSchema.parse(" Ada ")).toBe("Ada");
		expect(issueOf(displayNameSchema.safeParse("  "))).toBe("required");
		expect(issueOf(displayNameSchema.safeParse("x".repeat(101)))).toBe("too_long");
		expect(instanceNameSchema.parse("Aegis")).toBe("Aegis");
		expect(issueOf(instanceNameSchema.safeParse("x".repeat(65)))).toBe("too_long");
		expect(issueOf(instanceNameSchema.safeParse(""))).toBe("required");
	});
});
