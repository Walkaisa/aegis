import { describe, expect, it } from "vitest";
import { renderHook } from "vitest-browser-react";
import { useRouteId } from "@/hooks/use-route-id";
import { setLocation } from "../../support/next/navigation";

describe("useRouteId", () => {
	it("reads the id of a detail page", async () => {
		setLocation("/users/123/settings");
		expect((await renderHook(() => useRouteId())).result.current).toBe("123");

		setLocation("/");
		expect((await renderHook(() => useRouteId())).result.current).toBe("");
	});
});
