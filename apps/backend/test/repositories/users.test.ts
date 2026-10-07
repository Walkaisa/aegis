import { describe, expect } from "vitest";
import { test } from "../support/aegis.js";

describe("UserRepository", () => {
	test("finds no account for ids that are not snowflakes", async ({ aegis }) => {
		expect(await aegis.services.users.findById("someone@aegis.test")).toBeNull();
	});
});
