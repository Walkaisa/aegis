import { describe, expect, it } from "vitest";
import { signInRequestSchema } from "../src/auth";
import { issueCodes } from "./support/issues";

describe("signInRequestSchema", () => {
	it("trims the address and requires both fields", () => {
		expect(signInRequestSchema.parse({ email: " Ada@Example.com ", password: "x" })).toEqual({
			email: "Ada@Example.com",
			password: "x",
		});
		expect(issueCodes(signInRequestSchema, { email: "", password: "" })).toEqual(["required", "required"]);
	});
});
