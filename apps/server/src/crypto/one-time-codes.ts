import { createHash, randomInt } from "node:crypto";
import { RECOVERY_CODE_COUNT, TOTP_DIGITS, TOTP_PERIOD_SECONDS } from "@aegis/contracts";
import { Secret, TOTP } from "otpauth";

/** 160 bits, the size RFC 4226 recommends for HMAC-SHA1. */
const TOTP_SECRET_BYTES = 20;
/** Accepts the previous and the next code as well, to tolerate clock drift between devices. */
const TOTP_WINDOW = 1;

/** Without look-alike characters (0/O, 1/I/L), so codes can be typed from a printout. */
const RECOVERY_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const RECOVERY_GROUP_LENGTH = 5;

function totp(secret: string, issuer = "Aegis", label = "account"): TOTP {
	return new TOTP({
		issuer,
		label,
		algorithm: "SHA1",
		digits: TOTP_DIGITS,
		period: TOTP_PERIOD_SECONDS,
		secret: Secret.fromBase32(secret),
	});
}

/** A new TOTP secret, base32-encoded. */
export function generateTotpSecret(): string {
	return new Secret({ size: TOTP_SECRET_BYTES }).base32;
}

/** The `otpauth://` URI authenticator apps import through a QR code. */
export function totpUri(secret: string, issuer: string, accountName: string): string {
	return totp(secret, issuer, accountName).toString();
}

/** True for input that looks like an authenticator code rather than a recovery code. */
export function isTotpCode(code: string): boolean {
	return new RegExp(`^\\d{${TOTP_DIGITS}}$`).test(code.replace(/\s/g, ""));
}

/**
 * The time step a code belongs to, or `null` if it is not valid right now. Callers must accept each
 * time step only once to prevent a code from being replayed.
 */
export function matchTotp(secret: string, code: string, now = Date.now()): number | null {
	const token = code.replace(/\s/g, "");
	const delta = totp(secret).validate({ token, timestamp: now, window: TOTP_WINDOW });
	return delta === null ? null : Math.floor(now / 1000 / TOTP_PERIOD_SECONDS) + delta;
}

function recoveryGroup(): string {
	let group = "";
	for (let index = 0; index < RECOVERY_GROUP_LENGTH; index += 1) {
		group += RECOVERY_ALPHABET[randomInt(RECOVERY_ALPHABET.length)];
	}
	return group;
}

/** Recovery codes like `K7PQM-3XHVT`, about 49 bits of entropy each. */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
	const codes = new Set<string>();
	while (codes.size < count) {
		codes.add(`${recoveryGroup()}-${recoveryGroup()}`);
	}
	return [...codes];
}

/**
 * SHA-256 of the code without separators and case, so `k7pqm 3xhvt` matches `K7PQM-3XHVT`. The
 * codes are random and single-use, which makes a fast hash sufficient.
 */
export function hashRecoveryCode(code: string): string {
	const normalized = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
	return createHash("sha256").update(normalized, "utf8").digest("base64url");
}
