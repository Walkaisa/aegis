import { z } from "zod";
import type { ClientAccessPolicy } from "./clients";
import type { IsoDateString } from "./common";
import { displayNameSchema, emailSchema, newPasswordSchema } from "./identity";
import { ROLES, type Role } from "./roles";
import type { Snowflake } from "./snowflakes";

const roleSchema = z.enum(ROLES, { error: "invalid" });

export const userCreateSchema = z.object({
	displayName: displayNameSchema,
	email: emailSchema,
	password: newPasswordSchema,
	role: roleSchema,
	enabled: z.boolean(),
	emailVerified: z.boolean(),
});

export type UserCreateRequest = z.infer<typeof userCreateSchema>;

/** Enabling, disabling and password resets have dedicated endpoints. */
export const userUpdateSchema = z.object({
	displayName: displayNameSchema,
	email: emailSchema,
	role: roleSchema,
	emailVerified: z.boolean(),
});

export type UserUpdateRequest = z.infer<typeof userUpdateSchema>;

export const passwordResetSchema = z.discriminatedUnion("mode", [
	z.object({ mode: z.literal("generate") }),
	z.object({ mode: z.literal("manual"), password: newPasswordSchema }),
]);

export type PasswordResetRequest = z.infer<typeof passwordResetSchema>;

export interface UserDto {
	id: Snowflake;
	email: string;
	displayName: string;
	role: Role;
	enabled: boolean;
	emailVerified: boolean;
	/** `/api/media/avatars/<id>/<hash>.webp`, or `null` without a profile picture. */
	avatarUrl: string | null;
	activeSessionCount: number;
	/**
	 * The only enabled admin. At least one admin must always exist, so this account can neither be
	 * deleted, disabled nor changed to a user.
	 */
	isLastActiveAdmin: boolean;
	lastSignInAt: IsoDateString | null;
	passwordChangedAt: IsoDateString;
	/** Every sign-in asks for a code from an authenticator app or a recovery code. */
	twoFactorEnabled: boolean;
	createdAt: IsoDateString;
	updatedAt: IsoDateString;
}

export interface UserListResponse {
	users: UserDto[];
}

export interface UserResponse {
	user: UserDto;
}

export interface PasswordResetResponse {
	user: UserDto;
	/** Only set when Aegis generated the password; shown exactly once. */
	generatedPassword: string | null;
}

/** An application as seen from one account. */
export interface UserApplicationDto {
	id: Snowflake;
	name: string;
	logoUrl: string | null;
	enabled: boolean;
	accessPolicy: ClientAccessPolicy;
	/** Assigned to the account; decides the access while the policy is `assigned`. */
	assigned: boolean;
	/** Whether the account may sign in: admins always, users by access policy and assignment. */
	canSignIn: boolean;
}

export interface UserApplicationListResponse {
	applications: UserApplicationDto[];
}
