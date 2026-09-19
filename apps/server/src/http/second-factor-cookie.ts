import { SECOND_FACTOR_TTL_SECONDS } from "@aegis/contracts";
import type { FastifyReply, FastifyRequest } from "fastify";

const COOKIE_NAME = "aegis_second_factor";

/**
 * Carries a sign-in that waits for its second factor (see `SecondFactorChallenges`). Like the session
 * cookie, it uses the `__Host-` prefix on HTTPS deployments.
 */
export class SecondFactorCookie {
	public readonly name: string;
	private readonly secure: boolean;

	public constructor(secure: boolean) {
		this.secure = secure;
		this.name = secure ? `__Host-${COOKIE_NAME}` : COOKIE_NAME;
	}

	public read(request: FastifyRequest): string | undefined {
		return request.cookies[this.name];
	}

	public set(reply: FastifyReply, token: string): void {
		reply.setCookie(this.name, token, {
			path: "/",
			httpOnly: true,
			secure: this.secure,
			sameSite: "lax",
			maxAge: SECOND_FACTOR_TTL_SECONDS,
		});
	}

	public clear(reply: FastifyReply): void {
		reply.clearCookie(this.name, { path: "/", httpOnly: true, secure: this.secure, sameSite: "lax" });
	}
}
