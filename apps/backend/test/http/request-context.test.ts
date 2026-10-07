import type { FastifyRequest } from "fastify";
import { describe, expect, it } from "vitest";
import { requestMeta } from "../../src/http/request-context.js";

describe("requestMeta", () => {
	it("keeps what is known about the client and shortens the user agent", () => {
		const request = (ip: string | undefined, userAgent?: string) => ({ ip, headers: { "user-agent": userAgent } }) as FastifyRequest;

		expect(requestMeta(request("203.0.113.7", "x".repeat(600)))).toEqual({ ip: "203.0.113.7", userAgent: "x".repeat(512) });
		// A socket that closed early has no address left.
		expect(requestMeta(request(undefined))).toEqual({ ip: null, userAgent: null });
	});
});
