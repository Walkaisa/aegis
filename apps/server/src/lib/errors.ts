import type { ApiErrorBody, ApiErrorCode, ValidationIssue } from "@aegis/contracts";

/** An error that is safe to expose to API clients as-is. */
export class ApiError extends Error {
	public readonly statusCode: number;
	public readonly code: ApiErrorCode;
	public readonly issues: ValidationIssue[] | undefined;

	public constructor(statusCode: number, code: ApiErrorCode, message?: string, issues?: ValidationIssue[]) {
		super(message ?? code);
		this.name = "ApiError";
		this.statusCode = statusCode;
		this.code = code;
		this.issues = issues;
	}

	public toBody(): ApiErrorBody {
		return {
			error: {
				code: this.code,
				message: this.message,
				...(this.issues ? { issues: this.issues } : {}),
			},
		};
	}
}

export const unauthorized = () => new ApiError(401, "unauthorized", "Authentication required");
export const forbidden = () => new ApiError(403, "forbidden", "Permission denied");
export const notFound = (what = "Resource") => new ApiError(404, "not_found", `${what} not found`);
