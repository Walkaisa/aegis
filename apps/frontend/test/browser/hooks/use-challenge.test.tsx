import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useChallenge } from "@/hooks/use-challenge";
import { setLocation } from "../../support/next/navigation";

describe("useChallenge", () => {
	it("reads the challenge of the authorization request", async () => {
		setLocation("/sign-in?challenge=abc");

		expect((await renderHook(() => useChallenge())).result.current).toBe("abc");
	});
});
