import type { FastifyReply, FastifyRequest } from "fastify";
import { errors } from "oidc-provider";
import { describe, expect, it, vi } from "vitest";
import { errorHandler } from "../../src/http/error-handler.js";
import { ApiError } from "../../src/lib/errors.js";

/** Runs the handler and returns the status and body it answered with. */
function handle(error: Error) {
	const log = { error: vi.fn(), warn: vi.fn() };
	const reply = { code: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
	errorHandler(error, { log } as unknown as FastifyRequest, reply as unknown as FastifyReply);
	return { statusCode: reply.code.mock.calls[0]?.[0], body: reply.send.mock.calls[0]?.[0], log };
}

const fastifyError = (code: string, statusCode: number) => Object.assign(new Error(code), { code, statusCode });

describe("errorHandler", () => {
	it("answers API errors as they are and logs server-side ones", () => {
		expect(handle(new ApiError(404, "not_found", "Account not found"))).toMatchObject({
			statusCode: 404,
			body: { error: { code: "not_found" } },
		});

		const unavailable = handle(new ApiError(503, "setup_required", "Not set up"));
		expect(unavailable.statusCode).toBe(503);
		expect(unavailable.log.warn).toHaveBeenCalledWith({ code: "setup_required" }, "Not set up");
	});

	it("translates errors of Fastify and oidc-provider", () => {
		expect(handle(new errors.SessionNotFound("gone")).body.error.code).toBe("auth_request_expired");
		expect(handle(fastifyError("FST_ERR_CTP_INVALID_MEDIA_TYPE", 415)).body.error.code).toBe("unsupported_media_type");
		expect(handle(fastifyError("FST_ERR_CTP_BODY_TOO_LARGE", 413)).body.error.code).toBe("payload_too_large");
		expect(handle(fastifyError("FST_ERR_RATE_LIMITED", 429)).body.error.code).toBe("rate_limited");
		expect(handle(fastifyError("FST_ERR_CTP_INVALID_JSON_BODY", 400))).toMatchObject({
			statusCode: 400,
			body: { error: { code: "bad_request" } },
		});
	});

	it("hides everything else behind an internal error", () => {
		const failure = handle(new Error("connection refused at 10.0.0.5"));

		expect(failure).toMatchObject({
			statusCode: 500,
			body: { error: { code: "internal_error", message: "An unexpected error occurred" } },
		});
		expect(JSON.stringify(failure.body)).not.toContain("10.0.0.5");
		expect(failure.log.error).toHaveBeenCalledWith({ err: expect.any(Error) }, "Unhandled error");
		expect(handle(fastifyError("FST_ERR_SOMETHING", 502)).statusCode).toBe(500);
	});
});
