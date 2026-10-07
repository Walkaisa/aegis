import type { FastifyRequest, RouteOptions } from "fastify";
import { describe, expect, test as unit, vi } from "vitest";
import { getSession, requireAccessDeclaration } from "../../src/http/access.js";
import { test } from "../support/aegis.js";

describe("requireAccessDeclaration", () => {
	unit("refuses routes that do not declare who may call them", () => {
		const route = (config?: object) => ({ method: "GET", url: "/api/things", config }) as RouteOptions;

		expect(() => requireAccessDeclaration(route())).toThrow("GET /api/things does not declare who may call it");
		expect(() => requireAccessDeclaration(route({ access: "public" }))).not.toThrow();
	});
});

describe("getSession", () => {
	test("resolves the session of a request once", async ({ aegis }) => {
		const resolveSession = vi.spyOn(aegis.services.auth, "resolveSession");
		const request = { cookies: {} } as FastifyRequest;

		const [first, second] = await Promise.all([getSession(aegis.services, request), getSession(aegis.services, request)]);

		expect(first).toBeNull();
		expect(second).toBeNull();
		expect(resolveSession).toHaveBeenCalledOnce();
	});
});
