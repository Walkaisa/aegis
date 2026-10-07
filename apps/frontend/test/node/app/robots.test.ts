import { describe, expect, it } from "vitest";
import robots, { dynamic } from "@/app/robots";

describe("robots", () => {
	it("keeps every page out of search indexes", () => {
		expect(dynamic).toBe("force-static");
		expect(robots()).toEqual({ rules: { userAgent: "*", disallow: "/" } });
	});
});
