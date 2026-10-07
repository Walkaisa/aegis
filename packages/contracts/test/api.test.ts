import { describe, expect, it } from "vitest";
import { z } from "zod";
import { API_ERROR_CODES, idParamSchema, toValidationIssues } from "../src/api";

describe("toValidationIssues", () => {
	it("keeps known codes and joins paths", () => {
		const schema = z.object({ list: z.array(z.string().min(2, { error: "too_long" })), other: z.number({ error: "whatever" }) });
		const error = schema.safeParse({ list: ["a"], other: "x" }).error;
		expect(error && toValidationIssues(error)).toEqual([
			{ path: "list.0", code: "too_long" },
			{ path: "other", code: "invalid" },
		]);
	});
});

describe("API_ERROR_CODES", () => {
	it("lists every code once", () => {
		expect(new Set(API_ERROR_CODES).size).toBe(API_ERROR_CODES.length);
	});
});

describe("idParamSchema", () => {
	it("accepts snowflake IDs only", () => {
		expect(idParamSchema.parse({ id: "42" })).toEqual({ id: "42" });
		expect(idParamSchema.safeParse({ id: "abc" }).success).toBe(false);
	});
});
