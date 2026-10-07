import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "../../src/lib/errors.js";
import { parseInput } from "../../src/lib/validation.js";

describe("parseInput", () => {
	const schema = z.object({ name: z.string({ error: "required" }).min(1, { error: "required" }) });

	it("returns the parsed value", () => {
		expect(parseInput(schema, { name: "Ada" })).toEqual({ name: "Ada" });
	});

	it("treats a missing body as an empty object and reports the issues", () => {
		const error = (() => {
			try {
				parseInput(schema, undefined);
			} catch (caught) {
				return caught;
			}
		})();
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).toBody()).toEqual({
			error: { code: "validation_failed", message: "Request validation failed", issues: [{ path: "name", code: "required" }] },
		});
	});
});
