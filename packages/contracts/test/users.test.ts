import { describe, expect, it } from "vitest";
import { passwordResetSchema, userCreateSchema, userUpdateSchema } from "../src/users";
import { issueCodes } from "./support/issues";

const USER = { displayName: "Ada", email: "a@b.io", role: "admin", emailVerified: true };

describe("userCreateSchema and userUpdateSchema", () => {
	it("accept the known roles only", () => {
		expect(userCreateSchema.safeParse({ ...USER, password: "12345678", enabled: true }).success).toBe(true);
		expect(issueCodes(userUpdateSchema, { ...USER, role: "owner" })).toEqual(["invalid"]);
	});
});

describe("passwordResetSchema", () => {
	it("generates a password or takes one that follows the rules", () => {
		expect(passwordResetSchema.parse({ mode: "generate" })).toEqual({ mode: "generate" });
		expect(issueCodes(passwordResetSchema, { mode: "manual", password: "short" })).toEqual(["password_too_short"]);
	});
});
