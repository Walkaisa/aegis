import { API_PREFIX, type ApiErrorBody, type ApiErrorCode, type ValidationIssue } from "@aegis/contracts";
import { isAuthPage } from "@/lib/navigation";

export type ClientErrorCode = ApiErrorCode | "network_error";

export class ApiRequestError extends Error {
	public readonly status: number;
	public readonly code: ClientErrorCode;
	public readonly issues: ValidationIssue[];

	public constructor(status: number, code: ClientErrorCode, message: string, issues: ValidationIssue[] = []) {
		super(message);
		this.name = "ApiRequestError";
		this.status = status;
		this.code = code;
		this.issues = issues;
	}
}

interface RequestOptions {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	/** A binary body sent as-is with its own content type, e.g. an image upload. */
	file?: Blob;
	signal?: AbortSignal;
}

/** An expired session inside the administration UI leads back to the sign-in page. */
function redirectToSignIn() {
	const { pathname, search } = window.location;
	if (isAuthPage(pathname)) {
		return;
	}
	const target = `${pathname}${search}`;
	window.location.assign(target === "/" ? "/sign-in" : `/sign-in?next=${encodeURIComponent(target)}`);
}

/** Same-origin JSON request. Endpoints of the Aegis API are requested through `api` instead. */
export async function requestJson<T>(url: string, options: RequestOptions = {}): Promise<T> {
	const hasBody = options.body !== undefined;
	const headers: Record<string, string> = { accept: "application/json" };
	if (options.file) {
		headers["content-type"] = options.file.type;
	} else if (hasBody) {
		headers["content-type"] = "application/json";
	}
	let response: Response;

	try {
		response = await fetch(url, {
			method: options.method ?? "GET",
			credentials: "same-origin",
			cache: "no-store",
			headers,
			body: options.file ?? (hasBody ? JSON.stringify(options.body) : undefined),
			signal: options.signal,
		});
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			throw error;
		}
		throw new ApiRequestError(0, "network_error", "Network request failed");
	}

	if (response.status === 204) {
		return undefined as T;
	}

	const data: unknown = await response.json().catch(() => null);

	if (!response.ok) {
		const body = data as Partial<ApiErrorBody> | null;
		const code: ClientErrorCode = body?.error?.code ?? (response.status === 429 ? "rate_limited" : "internal_error");

		if (response.status === 401 && code === "unauthorized") {
			redirectToSignIn();
		}

		throw new ApiRequestError(response.status, code, body?.error?.message ?? response.statusText, body?.error?.issues ?? []);
	}

	return data as T;
}

/** URL of an endpoint of the Aegis API: `apiUrl("/users")` is `/api/users`. */
export function apiUrl(path: string): string {
	return `${API_PREFIX}${path}`;
}

/** The Aegis API. Paths are relative to the API prefix, e.g. `api.get("/users")`. */
export const api = {
	get: <T>(path: string, signal?: AbortSignal) => requestJson<T>(apiUrl(path), { signal }),
	post: <T>(path: string, body?: unknown) => requestJson<T>(apiUrl(path), { method: "POST", body }),
	put: <T>(path: string, body?: unknown) => requestJson<T>(apiUrl(path), { method: "PUT", body }),
	patch: <T>(path: string, body: unknown) => requestJson<T>(apiUrl(path), { method: "PATCH", body }),
	delete: <T = void>(path: string) => requestJson<T>(apiUrl(path), { method: "DELETE" }),
	upload: <T>(path: string, file: Blob) => requestJson<T>(apiUrl(path), { method: "PUT", file }),
};

export function isAbortError(error: unknown): boolean {
	return error instanceof DOMException && error.name === "AbortError";
}
