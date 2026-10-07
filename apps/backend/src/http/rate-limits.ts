/** A request limit per client IP. */
export interface RateLimit {
	max: number;
	timeWindow: string;
}

/**
 * Request limits per client IP, e.g. `access("public", rateLimits.signIn)`. Failed sign-ins are
 * additionally throttled over a longer window by `SignInThrottle`.
 */
export const rateLimits = {
	/** Sign-ins to the administration and to applications. */
	signIn: { max: 10, timeWindow: "1 minute" },
	/** Uploads, password changes and other sensitive account operations. */
	sensitive: { max: 10, timeWindow: "1 minute" },
	/** Rare and expensive operations: the initial setup and signing key rotations. */
	strict: { max: 5, timeWindow: "1 minute" },
	/** OpenID Connect protocol endpoints, called by applications and browsers. */
	protocol: { max: 300, timeWindow: "1 minute" },
} as const satisfies Record<string, RateLimit>;
