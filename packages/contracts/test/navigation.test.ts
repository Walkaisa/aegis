import { describe, expect, it } from "vitest";
import { localPath } from "../src/navigation";

describe("localPath", () => {
	it("keeps paths on the same origin, normalized like the browser does", () => {
		expect(localPath("/users/1?tab=sessions#top")).toEqual({ pathname: "/users/1", path: "/users/1?tab=sessions#top" });
		expect(localPath("/users/./1/../2")).toEqual({ pathname: "/users/2", path: "/users/2" });
		expect(localPath("/a\\b")).toEqual({ pathname: "/a/b", path: "/a/b" });
	});

	it("rejects everything the browser would take to another origin", () => {
		for (const value of [
			null,
			undefined,
			"",
			"users",
			"https://evil.example",
			"//evil.example",
			"/\\evil.example",
			"/\t/evil.example",
			"/\n/evil.example",
			"/.//evil.example",
			"//[",
		]) {
			expect(localPath(value), JSON.stringify(value)).toBeNull();
		}
	});
});
