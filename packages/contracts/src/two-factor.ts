import { z } from "zod";
import type { AuthRequestAccount } from "./auth";
import type { IsoDateString } from "./common";
import { existingPasswordSchema } from "./identity";

/*
 * Two-factor authentication with time-based one-time passwords (TOTP, RFC 6238) and one-time
 * recovery codes. Once enabled, every sign-in – to the administration and to applications – asks
 * for a code after the password.
 */

export const TOTP_DIGITS = 6;
export const TOTP_PERIOD_SECONDS = 30;
export const RECOVERY_CODE_COUNT = 10;
export const TOTP_LABEL_MAX_LENGTH = 64;

/** How long a correct password waits for the second factor. */
export const SECOND_FACTOR_TTL_SECONDS = 5 * 60;

/** The ways the second factor of a sign-in can be confirmed. */
export const SECOND_FACTOR_METHODS = ["totp", "recovery_code"] as const;
export type SecondFactorMethod = (typeof SECOND_FACTOR_METHODS)[number];

/**
 * Authentication method references (RFC 8176) of a sign-in, passed to applications in the `amr`
 * claim: `pwd` for the password, `otp` for an authenticator code, `mfa` once a second factor was used.
 */
export const AUTHENTICATION_METHODS = ["pwd", "otp", "mfa"] as const;
export type AuthenticationMethod = (typeof AUTHENTICATION_METHODS)[number];

/**
 * Authentication context classes passed to applications in the `acr` claim. An application can
 * request `urn:aegis:acr:mfa` through `acr_values`; accounts with two-factor authentication are then
 * asked for their code even when they are already signed in with the password only.
 */
export const ACR_VALUES = {
	password: "urn:aegis:acr:password",
	mfa: "urn:aegis:acr:mfa",
} as const;
export type AcrValue = (typeof ACR_VALUES)[keyof typeof ACR_VALUES];

/** A six-digit code from an authenticator app. Spaces, as some apps display them, are ignored. */
export const totpCodeSchema = z
	.string({ error: "required" })
	.transform((value) => value.replace(/\s/g, ""))
	.pipe(
		z
			.string()
			.min(1, { error: "required" })
			.regex(/^\d{6}$/, { error: "totp_code_invalid" }),
	);

/** An authenticator code or a recovery code; the server tells them apart by their format. */
export const secondFactorCodeSchema = z.string({ error: "required" }).trim().min(1, { error: "required" }).max(64, { error: "too_long" });

/** Confirms the second factor of a pending sign-in. */
export const secondFactorRequestSchema = z.object({ code: secondFactorCodeSchema });
export type SecondFactorRequest = z.infer<typeof secondFactorRequestSchema>;

/** Starts the setup; it requires the current password. */
export const twoFactorSetupSchema = z.object({ currentPassword: existingPasswordSchema });
export type TwoFactorSetupRequest = z.infer<typeof twoFactorSetupSchema>;

/** The name of the authenticator, e.g. "Bitwarden", so the account owner recognizes it later. */
export const totpLabelSchema = z
	.string({ error: "required" })
	.trim()
	.min(1, { error: "required" })
	.max(TOTP_LABEL_MAX_LENGTH, { error: "too_long" });

/** Completes the setup with a first code from the authenticator app and an optional name for it. */
export const twoFactorEnableSchema = z.object({ code: totpCodeSchema, label: totpLabelSchema.optional() });
export type TwoFactorEnableRequest = z.infer<typeof twoFactorEnableSchema>;

/** Turning two-factor authentication off and replacing the recovery codes require password and code. */
export const twoFactorConfirmSchema = z.object({ currentPassword: existingPasswordSchema, code: secondFactorCodeSchema });
export type TwoFactorConfirmRequest = z.infer<typeof twoFactorConfirmSchema>;

export interface TwoFactorStatusDto {
	enabled: boolean;
	enabledAt: IsoDateString | null;
	/** Name of the authenticator; `null` when none was given, the UI then shows a default. */
	label: string | null;
	/** Unused recovery codes; 0 while two-factor authentication is off. */
	recoveryCodesRemaining: number;
}

export interface TwoFactorStatusResponse {
	twoFactor: TwoFactorStatusDto;
}

/** The secret for the authenticator app, shown while the setup is pending. */
export interface TwoFactorSetupResponse {
	/** Base32, for manual entry. */
	secret: string;
	/** `otpauth://totp/...`, rendered as QR code. */
	otpauthUri: string;
	issuer: string;
	accountName: string;
	digits: number;
	period: number;
}

/** Newly issued recovery codes; they are shown exactly once. */
export interface RecoveryCodesResponse {
	codes: string[];
	twoFactor: TwoFactorStatusDto;
}

/** The password was correct; the sign-in continues once the second factor is confirmed. */
export interface SecondFactorPrompt {
	type: "second_factor";
	account: AuthRequestAccount;
	methods: SecondFactorMethod[];
	expiresAt: IsoDateString;
}
