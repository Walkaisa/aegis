import { z } from "zod";
import { snowflakeSchema } from "./snowflakes";

/**
 * Every endpoint of the Aegis API lives below this path. The server mounts the API here once, and
 * the web UI's client prepends it to every request, so no route repeats it.
 */
export const API_PREFIX = "/api";

/**
 * Stable, machine-readable error codes returned by the Aegis API.
 * The web UI maps every code to a localized message.
 */
export const API_ERROR_CODES = [
	"bad_request",
	"validation_failed",
	"unauthorized",
	"forbidden",
	"not_found",
	"rate_limited",
	"payload_too_large",
	"unsupported_media_type",
	"cross_origin_rejected",
	"internal_error",
	"service_unavailable",
	"setup_required",
	"setup_completed",
	"sign_in_failed",
	"sign_in_throttled",
	"invalid_current_password",
	"email_taken",
	"last_active_admin",
	"invalid_image",
	"auth_request_expired",
	"auth_request_invalid",
	"application_access_denied",
	"second_factor_invalid",
	"second_factor_expired",
	"two_factor_already_enabled",
	"two_factor_not_enabled",
	"two_factor_setup_required",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ValidationIssue {
	/** Dot-separated path of the offending field, e.g. `redirectUris.0`. */
	path: string;
	/** Translation key below `validation.*` in the web UI. */
	code: string;
}

export interface ApiErrorBody {
	error: {
		code: ApiErrorCode;
		message: string;
		issues?: ValidationIssue[];
	};
}

/** Validation message keys used as Zod error messages throughout the contracts. */
export const VALIDATION_CODES = [
	"required",
	"invalid",
	"too_long",
	"email_invalid",
	"password_too_short",
	"password_too_long",
	"redirect_uri_invalid",
	"redirect_uri_wildcard",
	"redirect_uri_fragment",
	"redirect_uri_credentials",
	"redirect_uri_insecure",
	"redirect_uri_custom_scheme",
	"redirect_uri_duplicate",
	"redirect_uris_required",
	"scope_openid_required",
	"pkce_required_for_public_clients",
	"too_many_items",
	"out_of_range",
	"totp_code_invalid",
] as const;

export type ValidationCode = (typeof VALIDATION_CODES)[number];

/** Converts a Zod error into the transport-friendly issue list used by the API and UI. */
export function toValidationIssues(error: z.ZodError): ValidationIssue[] {
	return error.issues.map((issue) => ({
		path: issue.path.map(String).join("."),
		code: (VALIDATION_CODES as readonly string[]).includes(issue.message) ? issue.message : "invalid",
	}));
}

/** The `:id` path parameter of routes that address a single entity, e.g. `/api/users/:id`. */
export const idParamSchema = z.object({
	id: snowflakeSchema,
});
