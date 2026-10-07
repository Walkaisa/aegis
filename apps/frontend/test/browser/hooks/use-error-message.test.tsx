import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useErrorMessage } from "@/hooks/use-error-message";
import { ApiRequestError } from "@/lib/api";
import { MESSAGES, Providers } from "../../support/render";

describe("useErrorMessage", () => {
	it("translates known error codes and nothing else", async () => {
		const { result } = await renderHook(() => useErrorMessage(), { wrapper: Providers });

		expect(result.current(new ApiRequestError(409, "email_taken", "taken"))).toBe(MESSAGES.en.errors.email_taken);
		expect(result.current(new ApiRequestError(400, "something_new" as never, "?"))).toBe(result.current(new Error("x")));
		expect(result.current("text")).toBe(MESSAGES.en.errors.internal_error);
	});
});
