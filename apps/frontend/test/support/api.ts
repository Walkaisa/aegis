import { vi } from "vitest";

export interface MockRequest {
	method: string;
	url: URL;
	/** The parsed JSON body, the raw body for other content types, `undefined` without a body. */
	body: unknown;
	headers: Headers;
	/** Values of `:name` segments in the route, e.g. `id` for `GET /api/users/:id`. */
	params: Record<string, string>;
}

export interface MockResponse {
	status?: number;
	body?: unknown;
}

/**
 * A response, a function computing one, `"pending"` for a request that never completes, or
 * `"network-error"` for a request that fails before reaching the server.
 */
export type Route = MockResponse | ((request: MockRequest) => MockResponse | Promise<MockResponse>) | "pending" | "network-error";

interface Registered {
	key: string;
	method: string;
	pattern: RegExp;
	params: string[];
	route: Route;
}

function compile(key: string, route: Route): Registered {
	const [method = "GET", path = "/"] = key.split(" ");
	const params: string[] = [];
	const source = path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/:(\w+)/g, (_match, name: string) => {
		params.push(name);
		return "([^/]+)";
	});
	return { key, method, pattern: new RegExp(`^${source}$`), params, route };
}

export interface ApiMock {
	/** Adds or replaces routes, e.g. `api.on({ "GET /api/users": { body: { users: [] } } })`. */
	on(routes: Record<string, Route>): ApiMock;
	/** Requests received for a route key, oldest first. */
	calls(key: string): MockRequest[];
	/** Requests no route answered; tests fail if any remain. */
	unhandled: MockRequest[];
}

let active: ApiMock | null = null;

function parseBody(raw: BodyInit | null | undefined, headers: Headers): unknown {
	if (typeof raw === "string" && headers.get("content-type")?.includes("json")) {
		return JSON.parse(raw);
	}
	return raw ?? undefined;
}

/**
 * Answers `fetch` from a route table: `"GET /api/users/:id": { body: … }`. Unknown requests are
 * answered with 500 and reported after the test, so a component never talks to anything unexpected.
 */
export function mockApi(routes: Record<string, Route> = {}): ApiMock {
	const registered: Registered[] = [];
	const received: { key: string; request: MockRequest }[] = [];
	const unhandled: MockRequest[] = [];

	const mock: ApiMock = {
		on(next) {
			for (const [key, route] of Object.entries(next)) {
				const entry = compile(key, route);
				const index = registered.findIndex((existing) => existing.key === key);
				if (index === -1) {
					registered.push(entry);
				} else {
					registered[index] = entry;
				}
			}
			return mock;
		},
		calls(key) {
			return received.filter((call) => call.key === key).map((call) => call.request);
		},
		unhandled,
	};

	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
		const method = (init?.method ?? "GET").toUpperCase();
		const headers = new Headers(init?.headers);
		const match = registered.find((entry) => entry.method === method && entry.pattern.test(url.pathname));
		const values = match?.pattern.exec(url.pathname)?.slice(1) ?? [];
		const params = Object.fromEntries((match?.params ?? []).map((name, index) => [name, decodeURIComponent(values[index] ?? "")]));
		const request: MockRequest = { method, url, body: parseBody(init?.body, headers), headers, params };

		if (!match) {
			unhandled.push(request);
			return new Response(JSON.stringify({ error: { code: "internal_error", message: "Unhandled in test" } }), { status: 500 });
		}
		received.push({ key: match.key, request });

		if (match.route === "pending") {
			return new Promise<Response>((_resolve, reject) => {
				init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
			});
		}
		if (match.route === "network-error") {
			throw new TypeError("Failed to fetch");
		}
		const result = typeof match.route === "function" ? await match.route(request) : match.route;
		const status = result.status ?? 200;
		const payload = status === 204 || result.body === undefined ? null : JSON.stringify(result.body);
		return new Response(payload, { status, headers: payload === null ? {} : { "content-type": "application/json" } });
	});

	mock.on(routes);
	active = mock;
	return mock;
}

/** Called after every test: fails it if a component made a request no route answered. */
export function verifyApi(): void {
	const unhandled = active?.unhandled ?? [];
	active = null;
	if (unhandled.length > 0) {
		const list = unhandled.map((request) => `  ${request.method} ${request.url.pathname}${request.url.search}`).join("\n");
		throw new Error(`Unhandled API requests:\n${list}`);
	}
}

/** An error response in the shape of the Aegis API. */
export function apiError(status: number, code: string, issues?: { path: string; code: string }[]): MockResponse {
	return { status, body: { error: { code, message: code, ...(issues ? { issues } : {}) } } };
}
