import { describe, expect, it } from "vitest";
import { setupRequestSchema } from "../src/instance";
import { issueCodes } from "./support/issues";

describe("setupRequestSchema", () => {
	it("needs the instance name and the first administrator", () => {
		expect(setupRequestSchema.safeParse({ instanceName: "A", displayName: "B", email: "a@b.io", password: "12345678" }).success).toBe(
			true,
		);
		expect(issueCodes(setupRequestSchema, { instanceName: "", displayName: "B", email: "a@b.io", password: "short" })).toEqual([
			"required",
			"password_too_short",
		]);
	});
});
