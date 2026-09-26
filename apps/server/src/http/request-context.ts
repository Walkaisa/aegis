import { idParamSchema, LOCALE_COOKIE, type Locale, resolveLocale } from "@aegis/contracts";
import type { SystemSettingsRecord } from "@aegis/db";
import type { FastifyRequest } from "fastify";
import { ApiError } from "../lib/errors.js";
import { parseInput } from "../lib/validation.js";
import type { RequestMeta } from "../services/auth.js";
import type { AppServices } from "../services/container.js";

const MAX_USER_AGENT_LENGTH = 512;

export function requireSettings(services: AppServices): SystemSettingsRecord {
	const settings = services.settings.get();
	if (!settings) {
		throw new ApiError(409, "setup_required", "The initial setup has not been completed");
	}
	return settings;
}

export function requestMeta(request: FastifyRequest): RequestMeta {
	const userAgent = request.headers["user-agent"];
	return {
		ip: request.ip || null,
		userAgent: typeof userAgent === "string" ? userAgent.slice(0, MAX_USER_AGENT_LENGTH) : null,
	};
}

/**
 * The language of the browser making the request: an explicit choice from the preference cookie,
 * otherwise `Accept-Language`. E-mails triggered by a request are written in it, so a message
 * arrives in the language the page that caused it was read in.
 */
export function requestLocale(request: FastifyRequest): Locale {
	return resolveLocale(request.cookies[LOCALE_COOKIE], request.headers["accept-language"]);
}

/** The snowflake in the `:id` path parameter; `validation_failed` for anything else. */
export function idParam(request: FastifyRequest): string {
	return parseInput(idParamSchema, request.params).id;
}
