import { z } from "zod";
import { codePointLength } from "./common";

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 256;

/**
 * Passwords are never trimmed or Unicode-normalized: every character, including
 * umlauts and whitespace, is part of the secret exactly as it was entered.
 */
export const newPasswordSchema = z
	.string({ error: "required" })
	.refine((value) => codePointLength(value) >= PASSWORD_MIN_LENGTH, {
		error: "password_too_short",
	})
	.refine((value) => codePointLength(value) <= PASSWORD_MAX_LENGTH, {
		error: "password_too_long",
	});

/** A password that is verified against a stored hash (sign-in, re-authentication). */
export const existingPasswordSchema = z
	.string({ error: "required" })
	.min(1, { error: "required" })
	.max(PASSWORD_MAX_LENGTH * 4, { error: "password_too_long" });

/**
 * The checks shown by the password strength meter. Only `length` is enforced by
 * `newPasswordSchema`; the remaining ones are guidance towards a stronger password.
 */
export const PASSWORD_REQUIREMENTS = ["length", "lowercase", "uppercase", "digit", "symbol"] as const;

export type PasswordRequirement = (typeof PASSWORD_REQUIREMENTS)[number];

export type PasswordRequirementChecks = Record<PasswordRequirement, boolean>;

export function evaluatePassword(password: string): PasswordRequirementChecks {
	return {
		length: codePointLength(password) >= PASSWORD_MIN_LENGTH,
		lowercase: /\p{Ll}/u.test(password),
		uppercase: /\p{Lu}/u.test(password),
		digit: /\p{Nd}/u.test(password),
		symbol: /[^\p{L}\p{Nd}]/u.test(password),
	};
}

export const PASSWORD_STRENGTH_LEVELS = ["weak", "fair", "good", "strong"] as const;

export type PasswordStrengthLevel = (typeof PASSWORD_STRENGTH_LEVELS)[number];

export interface PasswordStrength {
	/** Number of met requirements, 0 to `PASSWORD_REQUIREMENTS.length`. */
	score: number;
	level: PasswordStrengthLevel;
}

export function passwordStrength(password: string): PasswordStrength {
	if (password.length === 0) {
		return { score: 0, level: "weak" };
	}

	const score = Object.values(evaluatePassword(password)).filter(Boolean).length;
	const level: PasswordStrengthLevel = score <= 1 ? "weak" : score === 2 ? "fair" : score === 3 ? "good" : "strong";

	return { score, level };
}

export const EMAIL_MAX_LENGTH = 254;

export const emailSchema = z
	.string({ error: "required" })
	.trim()
	.min(1, { error: "required" })
	.max(EMAIL_MAX_LENGTH, { error: "too_long" })
	.pipe(z.email({ error: "email_invalid" }));

/** Canonical form used when comparing e-mail addresses. */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export const displayNameSchema = z.string({ error: "required" }).trim().min(1, { error: "required" }).max(100, { error: "too_long" });

export const instanceNameSchema = z.string({ error: "required" }).trim().min(1, { error: "required" }).max(64, { error: "too_long" });
