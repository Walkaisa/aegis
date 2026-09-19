import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** URL-safe random token with `bytes` bytes of entropy. */
export function randomToken(bytes = 32): string {
	return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
	return createHash("sha256").update(value, "utf8").digest("base64url");
}

/** Constant-time string comparison that does not leak the length of either input. */
export function constantTimeEqual(a: string, b: string): boolean {
	const left = createHash("sha256").update(a, "utf8").digest();
	const right = createHash("sha256").update(b, "utf8").digest();
	return timingSafeEqual(left, right);
}
