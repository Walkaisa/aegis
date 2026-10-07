import { describe, expect, it } from "vitest";
import { SessionCookie } from "../../src/http/session-cookie.js";

describe("SessionCookie", () => {
	it("uses the __Host- prefix on HTTPS deployments", () => {
		expect(new SessionCookie(true).name).toBe("__Host-aegis_session");
		expect(new SessionCookie(false).name).toBe("aegis_session");
	});

	it("removes the session outside of Fastify with the same attributes", () => {
		expect(new SessionCookie(true).clearHeaderValue()).toBe(
			"__Host-aegis_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax; Secure",
		);
		expect(new SessionCookie(false).clearHeaderValue()).not.toContain("Secure");
	});
});
