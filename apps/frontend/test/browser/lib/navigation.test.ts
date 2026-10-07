import { describe, expect, it } from "vitest";
import { initials, isAuthPage, safeAdminPath } from "@/lib/navigation";

describe("navigation", () => {
	it("knows the pages outside the administration", () => {
		expect(isAuthPage("/sign-in")).toBe(true);
		expect(isAuthPage("/users")).toBe(false);
	});

	it("only returns to pages of the administration", () => {
		expect(safeAdminPath("/users/1?tab=x#top")).toBe("/users/1?tab=x#top");
		for (const value of [
			null,
			undefined,
			"",
			"users",
			"//evil.example",
			"/\\evil.example",
			"/\t/evil.example",
			"/sign-in?next=/",
			"/api/users",
			"/.well-known/x",
		]) {
			expect(safeAdminPath(value), String(value)).toBe("/");
		}
	});

	it("abbreviates names", () => {
		expect(initials("Ada Lovelace")).toBe("AL");
		expect(initials("  grace  brewster hopper ")).toBe("GH");
		expect(initials("ümit")).toBe("Ü");
		expect(initials("   ")).toBe("");
	});
});
