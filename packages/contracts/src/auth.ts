import { z } from "zod";
import type { SupportedScope } from "./clients";
import type { IsoDateString } from "./common";
import { EMAIL_MAX_LENGTH, existingPasswordSchema } from "./identity";
import type { Permission } from "./roles";
import type { Snowflake } from "./snowflakes";
import type { SecondFactorPrompt } from "./two-factor";
import type { UserDto } from "./users";

/*
 * Signing in. One session per browser serves the administration and applications alike:
 * - `/api/auth/session`: signs in to the administration, which requires `console:access`,
 * - `/api/auth/requests/:challenge`: signs in to an application, within its access policy.
 */

export const signInRequestSchema = z.object({
	email: z.string({ error: "required" }).trim().min(1, { error: "required" }).max(EMAIL_MAX_LENGTH, { error: "too_long" }),
	password: existingPasswordSchema,
});

export type SignInRequest = z.infer<typeof signInRequestSchema>;

export interface CurrentSessionDto {
	id: Snowflake;
	authenticatedAt: IsoDateString;
	expiresAt: IsoDateString;
}

/** The signed-in account and what it may do. */
export interface AuthSessionResponse {
	account: UserDto;
	session: CurrentSessionDto;
	/** Permissions of the account's role; the administration requires `console:access`. */
	permissions: Permission[];
	instanceName: string;
}

/** Signing in to the administration either starts the session or asks for the second factor first. */
export type AdminSignInResponse = ({ type: "signed_in" } & AuthSessionResponse) | SecondFactorPrompt;

export interface AuthRequestClient {
	/** The application's snowflake, which is also its OAuth `client_id`. */
	id: Snowflake;
	name: string;
	description: string;
	logoUrl: string | null;
	/** Host of the redirect URI used for this request, shown to the user for orientation. */
	redirectOrigin: string | null;
}

/** An account as shown on the sign-in and consent pages. */
export interface AuthRequestAccount {
	displayName: string;
	email: string;
	avatarUrl: string | null;
}

export interface AuthRequestRedirect {
	type: "redirect";
	redirectTo: string;
}

export interface AuthRequestSignInPrompt {
	type: "sign_in";
	challenge: string;
	instanceName: string;
	client: AuthRequestClient;
	emailHint: string | null;
	/** True when the client explicitly demanded a fresh authentication (prompt=login, max_age). */
	reauthenticationRequired: boolean;
	/** The account signed in in this browser when it may not sign in to this application. */
	deniedAccount: AuthRequestAccount | null;
	/** What the application asks for; shown before signing in, since trusted applications skip the consent step. */
	scopes: SupportedScope[];
	/** Whether the page offers a password reset; requires a working e-mail server. */
	passwordResetEnabled: boolean;
}

export interface AuthRequestConsentPrompt {
	type: "consent";
	challenge: string;
	instanceName: string;
	client: AuthRequestClient;
	account: AuthRequestAccount;
	scopes: SupportedScope[];
}

/**
 * The account is signed in in this browser with its password, but the application asks for a second
 * factor (`acr_values`); confirming the code is enough.
 */
export interface AuthRequestSecondFactorPrompt extends SecondFactorPrompt {
	challenge: string;
	instanceName: string;
	client: AuthRequestClient;
}

export type AuthRequestContextResponse =
	| AuthRequestRedirect
	| AuthRequestSignInPrompt
	| AuthRequestSecondFactorPrompt
	| AuthRequestConsentPrompt;

/** Answering the sign-in prompt continues the authorization request or asks for the second factor first. */
export type AuthRequestSignInResponse = AuthRequestRedirect | SecondFactorPrompt;
