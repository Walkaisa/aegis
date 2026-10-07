import type { FastifyInstance, InjectOptions, LightMyRequestResponse as Response } from "fastify";

type Method = "GET" | "HEAD" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS";

export interface RequestOptions {
	headers?: Record<string, string>;
	/** A JSON body; `payload` sends raw bytes instead. */
	body?: unknown;
	payload?: InjectOptions["payload"];
}

/**
 * A browser against the in-process server (`app.inject`): it keeps cookies between requests, like
 * a browser does for one origin, visits the issuer's host and comes from its own IP address, so rate
 * limits of different clients never interfere.
 */
export class TestClient {
	private static nextAddress = 1;
	public readonly ip: string;
	private readonly app: FastifyInstance;
	private readonly host: string;
	private readonly jar = new Map<string, string>();

	public constructor(app: FastifyInstance, issuer: string, ip?: string) {
		this.app = app;
		this.host = new URL(issuer).host;
		this.ip = ip ?? `10.0.${Math.floor(TestClient.nextAddress / 250)}.${(TestClient.nextAddress++ % 250) + 1}`;
	}

	public cookie(name: string): string | undefined {
		return this.jar.get(name);
	}

	public setCookie(name: string, value: string): void {
		this.jar.set(name, value);
	}

	public deleteCookie(name: string): void {
		this.jar.delete(name);
	}

	public async request(method: Method, url: string, options: RequestOptions = {}): Promise<Response> {
		const headers: Record<string, string> = { host: this.host, "user-agent": "Aegis tests", ...options.headers };
		if (this.jar.size > 0 && !("cookie" in headers)) {
			headers.cookie = [...this.jar].map(([name, value]) => `${name}=${value}`).join("; ");
		}
		const hasJson = options.body !== undefined;
		if (hasJson && !("content-type" in headers)) {
			headers["content-type"] = "application/json";
		}

		const response = await this.app.inject({
			method,
			url,
			headers,
			remoteAddress: this.ip,
			payload: hasJson ? JSON.stringify(options.body) : options.payload,
		});

		for (const cookie of response.cookies) {
			const expired = cookie.maxAge === 0 || (cookie.expires !== undefined && cookie.expires.getTime() <= Date.now());
			if (expired || cookie.value === "") {
				this.jar.delete(cookie.name);
			} else {
				this.jar.set(cookie.name, cookie.value);
			}
		}
		return response;
	}

	public get(url: string, options?: RequestOptions): Promise<Response> {
		return this.request("GET", url, options);
	}

	public post(url: string, body?: unknown, options?: RequestOptions): Promise<Response> {
		return this.request("POST", url, { ...options, body });
	}

	public put(url: string, body?: unknown, options?: RequestOptions): Promise<Response> {
		return this.request("PUT", url, { ...options, body });
	}

	public patch(url: string, body?: unknown, options?: RequestOptions): Promise<Response> {
		return this.request("PATCH", url, { ...options, body });
	}

	public delete(url: string, options?: RequestOptions): Promise<Response> {
		return this.request("DELETE", url, options);
	}
}
