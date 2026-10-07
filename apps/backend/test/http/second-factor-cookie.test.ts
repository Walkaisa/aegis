import { describe, expect, it } from "vitest";
import { SecondFactorCookie } from "../../src/http/second-factor-cookie.js";

describe("SecondFactorCookie", () => {
	it("uses the __Host- prefix on HTTPS deployments", () => {
		expect(new SecondFactorCookie(true).name).toBe("__Host-aegis_second_factor");
		expect(new SecondFactorCookie(false).name).toBe("aegis_second_factor");
	});
});
