import { describe, expect, it } from "vitest";
import { passwordChangeSchema, profileUpdateSchema } from "../src/account";
import { issueCodes } from "./support/issues";

describe("profileUpdateSchema", () => {
	it("accepts a name and an address", () => {
		expect(profileUpdateSchema.safeParse({ displayName: "Ada", email: "a@b.io" }).success).toBe(true);
	});
});

describe("passwordChangeSchema", () => {
	it("holds the new password to the password rules", () => {
		expect(issueCodes(passwordChangeSchema, { currentPassword: "x", newPassword: "short" })).toEqual(["password_too_short"]);
	});
});
