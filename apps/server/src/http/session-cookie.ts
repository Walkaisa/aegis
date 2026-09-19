import type { FastifyReply, FastifyRequest } from "fastify";

const COOKIE_NAME = "aegis_session";

/**
 * The Aegis session cookie, shared by the administration and application sign-ins (see
 * `http/access.ts`). On HTTPS deployments it uses the `__Host-` prefix, which forces `Secure`,
 * `Path=/` and forbids a `Domain` attribute, so it can never be shared with other applications on
 * sibling subdomains.
 */
export class SessionCookie {
	public readonly name: string;
	private readonly secure: boolean;

	public constructor(secure: boolean) {
		this.secure = secure;
		this.name = secure ? `__Host-${COOKIE_NAME}` : COOKIE_NAME;
	}

	public read(request: FastifyRequest): string | undefined {
		return request.cookies[this.name];
	}

	public set(reply: FastifyReply, token: string, expiresAt: Date): void {
		reply.setCookie(this.name, token, {
			path: "/",
			httpOnly: true,
			secure: this.secure,
			sameSite: "lax",
			expires: expiresAt,
		});
	}

	public clear(reply: FastifyReply): void {
		reply.clearCookie(this.name, { path: "/", httpOnly: true, secure: this.secure, sameSite: "lax" });
	}

	/** `Set-Cookie` header value that removes the cookie, for responses not produced by Fastify. */
	public clearHeaderValue(): string {
		return `${this.name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly; SameSite=Lax${this.secure ? "; Secure" : ""}`;
	}
}
