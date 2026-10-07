import { describe, expect, it } from "vitest";
import { ApiError, forbidden, notFound, unauthorized } from "../../src/lib/errors.js";

describe("ApiError", () => {
	it("serializes to the API error body", () => {
		expect(new ApiError(400, "bad_request").toBody()).toEqual({ error: { code: "bad_request", message: "bad_request" } });
		expect(new ApiError(400, "validation_failed", "Invalid", [{ path: "email", code: "required" }]).toBody()).toEqual({
			error: { code: "validation_failed", message: "Invalid", issues: [{ path: "email", code: "required" }] },
		});
	});

	it("offers the common errors", () => {
		expect(unauthorized()).toMatchObject({ statusCode: 401, code: "unauthorized", name: "ApiError" });
		expect(forbidden()).toMatchObject({ statusCode: 403, code: "forbidden" });
		expect(notFound().message).toBe("Resource not found");
		expect(notFound("Account").message).toBe("Account not found");
	});
});
