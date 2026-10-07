import { describe, expect, it } from "vitest";
import { AEGIS_REPOSITORY, AEGIS_REPOSITORY_URL } from "../src/updates";

describe("AEGIS_REPOSITORY_URL", () => {
	it("points to the repository of the project", () => {
		expect(AEGIS_REPOSITORY_URL).toBe(`https://github.com/${AEGIS_REPOSITORY}`);
	});
});
