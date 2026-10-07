import { PASSWORD_MIN_LENGTH } from "@aegis/contracts";
import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { z } from "zod";
import { useFormErrors } from "@/hooks/use-form-errors";
import { ApiRequestError } from "@/lib/api";
import { MESSAGES, Providers } from "../../support/render";

describe("useFormErrors", () => {
	const schema = z.object({ email: z.string().email({ error: "invalid_email" }), name: z.string().min(1, { error: "required" }) });

	it("validates with a schema and translates the issues", async () => {
		const { result, act } = await renderHook(() => useFormErrors(), { wrapper: Providers });

		let parsed: unknown;
		act(() => {
			parsed = result.current.validate(schema, { email: "nope", name: "" });
		});
		expect(parsed).toBeNull();
		expect(Object.keys(result.current.errors)).toEqual(["email", "name"]);

		act(() => {
			parsed = result.current.validate(schema, { email: "ada@example.com", name: "Ada" });
		});
		expect(parsed).toEqual({ email: "ada@example.com", name: "Ada" });
		expect(result.current.errors).toEqual({});
	});

	it("applies validation issues of the API, the first per field", async () => {
		const { result, act } = await renderHook(() => useFormErrors(), { wrapper: Providers });

		let applied = false;
		act(() => {
			applied = result.current.applyApiError(
				new ApiRequestError(400, "validation_failed", "invalid", [
					{ path: "password", code: "password_too_short" },
					{ path: "password", code: "required" },
					{ path: "email", code: "a_code_nobody_knows" },
				]),
			);
		});
		expect(applied).toBe(true);
		expect(result.current.errors.password).toBe(`Use at least ${PASSWORD_MIN_LENGTH} characters.`);
		expect(result.current.errors.email).toBe(MESSAGES.en.validation.invalid);

		act(() => {
			applied = result.current.applyApiError(new ApiRequestError(409, "email_taken", "taken"));
		});
		expect(applied).toBe(false);

		act(() => result.current.setFieldError("name", "required"));
		expect(Object.keys(result.current.errors)).toEqual(["password", "email", "name"]);
		act(() => result.current.clear());
		expect(result.current.errors).toEqual({});
	});
});
