import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS, ROLE_PERMISSIONS } from "../src/roles";

describe("hasPermission", () => {
	it("gives admins everything and users only application sign-ins", () => {
		expect(ROLE_PERMISSIONS.admin).toEqual(PERMISSIONS);
		expect(PERMISSIONS.every((permission) => hasPermission("admin", permission))).toBe(true);
		expect(hasPermission("user", "applications:sign_in")).toBe(true);
		expect(PERMISSIONS.filter((permission) => hasPermission("user", permission))).toEqual(["applications:sign_in"]);
	});
});
