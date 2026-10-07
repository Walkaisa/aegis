import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { errors as oidcErrors } from "oidc-provider";
import { ApiError } from "../lib/errors.js";

function toApiError(error: FastifyError | Error, request: FastifyRequest): ApiError {
	if (error instanceof ApiError) {
		return error;
	}

	if (error instanceof oidcErrors.SessionNotFound) {
		return new ApiError(404, "auth_request_expired", "The sign-in request has expired");
	}

	const fastifyError = error as Partial<FastifyError>;
	switch (fastifyError.code) {
		case "FST_ERR_CTP_INVALID_MEDIA_TYPE":
			return new ApiError(415, "unsupported_media_type", "Only application/json is accepted");
		case "FST_ERR_CTP_BODY_TOO_LARGE":
			return new ApiError(413, "payload_too_large", "Request body is too large");
		default:
			break;
	}

	const statusCode = fastifyError.statusCode;
	if (statusCode === 429) {
		return new ApiError(429, "rate_limited", "Too many requests");
	}
	if (typeof statusCode === "number" && statusCode >= 400 && statusCode < 500) {
		return new ApiError(statusCode, "bad_request", "Bad request");
	}

	request.log.error({ err: error }, "Unhandled error");
	return new ApiError(500, "internal_error", "An unexpected error occurred");
}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply): void {
	const apiError = toApiError(error, request);
	if (apiError.statusCode >= 500 && error instanceof ApiError) {
		request.log.warn({ code: apiError.code }, apiError.message);
	}
	void reply.code(apiError.statusCode).send(apiError.toBody());
}
