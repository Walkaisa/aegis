import type { Role } from "@aegis/contracts";
import { DAY_MS, SECOND_MS } from "../lib/time.js";

export const DEFAULT_SESSION_TTL_SECONDS = (30 * DAY_MS) / SECOND_MS;

export interface SessionPolicy {
	/** Lifetime of a new session. */
	ttlMs: number;
}

/**
 * Session rules per role. Admin and user sessions currently share the lifetime from the instance
 * settings; stricter admin rules (shorter lifetime, idle timeout) belong here.
 */
export function getSessionPolicy(role: Role, sessionTtlSeconds: number): SessionPolicy {
	const policies: Record<Role, SessionPolicy> = {
		admin: { ttlMs: sessionTtlSeconds * SECOND_MS },
		user: { ttlMs: sessionTtlSeconds * SECOND_MS },
	};
	return policies[role];
}
